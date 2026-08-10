//! Browser wrapper around the sparse curve learner in ../phi-chatbot.
//!
//! The input is UTF-8 TSV (`child response<TAB>root<RS>...<RS>parent`). Each
//! response gets a sparse classifier over its weighted ancestry contexts and
//! the exported points are their aggregate `phi_all` curve, as in
//! phi-chatbot's `curve` command.

use std::collections::{BTreeMap, BTreeSet, HashMap};

const CONTROL_POINT_COUNT: usize = 8;
const LEARNING_RATE: f64 = 0.08;
const MAX_EPOCHS: usize = 2000;
const EPSILON: f64 = 0.02;
const CONTEXT_DECAY: f64 = 0.65;

static mut RESULT_POINTER: *mut u8 = std::ptr::null_mut();
static mut RESULT_LENGTH: usize = 0;

#[derive(Clone, Debug)]
struct Example {
    response: String,
    features: Vec<WeightedFeature>,
}

#[derive(Clone, Debug)]
struct WeightedFeature {
    index: usize,
    value: f64,
}

#[derive(Debug)]
struct SparseTerm {
    key: Vec<usize>,
    value: f64,
}

#[derive(Debug)]
struct SparseCurve {
    control_points: [f64; CONTROL_POINT_COUNT],
}

impl SparseCurve {
    fn new() -> Self {
        Self {
            control_points: [0.0; CONTROL_POINT_COUNT],
        }
    }

    fn value(&self, input: f64) -> f64 {
        let input = input.clamp(0.0, 1.0);
        let scaled = input * (CONTROL_POINT_COUNT - 1) as f64;
        let lower = scaled.floor() as usize;
        let upper = (lower + 1).min(CONTROL_POINT_COUNT - 1);
        let upper_weight = scaled - lower as f64;

        input
            * (self.control_points[lower] * (1.0 - upper_weight)
                + self.control_points[upper] * upper_weight)
    }

    fn train(&mut self, input: f64, error: f64) {
        let input = input.clamp(0.0, 1.0);
        let scaled = input * (CONTROL_POINT_COUNT - 1) as f64;
        let lower = scaled.floor() as usize;
        let upper = (lower + 1).min(CONTROL_POINT_COUNT - 1);
        let upper_weight = scaled - lower as f64;

        self.control_points[lower] += LEARNING_RATE * error * input * (1.0 - upper_weight);
        self.control_points[upper] += LEARNING_RATE * error * input * upper_weight;
    }
}

#[no_mangle]
pub extern "C" fn alloc(length: usize) -> *mut u8 {
    let mut bytes = Vec::<u8>::with_capacity(length);
    let pointer = bytes.as_mut_ptr();
    std::mem::forget(bytes);
    pointer
}

#[no_mangle]
pub unsafe extern "C" fn dealloc(pointer: *mut u8, length: usize) {
    if !pointer.is_null() && length > 0 {
        drop(Vec::from_raw_parts(pointer, 0, length));
    }
}

#[no_mangle]
pub unsafe extern "C" fn train_phi(pointer: *const u8, length: usize) {
    let result = if pointer.is_null() || length == 0 {
        Err("The walkthrough has no feature text to train.")
    } else {
        std::str::from_utf8(std::slice::from_raw_parts(pointer, length))
            .map_err(|_| "The walkthrough text is not valid UTF-8.")
            .and_then(train)
    };

    let json = match result {
        Ok(report) => report,
        Err(message) => format!("{{\"error\":\"{message}\"}}"),
    };
    if !RESULT_POINTER.is_null() {
        drop(Box::from_raw(std::slice::from_raw_parts_mut(
            RESULT_POINTER,
            RESULT_LENGTH,
        )));
    }

    let result = json.into_bytes().into_boxed_slice();
    RESULT_LENGTH = result.len();
    RESULT_POINTER = Box::into_raw(result) as *mut u8;
}

#[no_mangle]
pub unsafe extern "C" fn result_ptr() -> *const u8 {
    RESULT_POINTER
}

#[no_mangle]
pub unsafe extern "C" fn result_len() -> usize {
    RESULT_LENGTH
}

fn train(input: &str) -> Result<String, &'static str> {
    let rows = input
        .lines()
        .filter_map(|line| line.split_once('\t'))
        .map(|(response, message)| (response.trim(), message.trim()))
        .filter(|(response, message)| !response.is_empty() && !message.is_empty())
        .collect::<Vec<_>>();

    if rows.is_empty() {
        return Err("The walkthrough has no trainable feature text.");
    }

    let vocabulary = rows
        .iter()
        .flat_map(|(_, message)| {
            message
                .split('\u{1e}')
                .flat_map(tokenize)
                .collect::<Vec<_>>()
        })
        .collect::<BTreeSet<_>>()
        .into_iter()
        .enumerate()
        .map(|(index, token)| (token, index))
        .collect::<BTreeMap<_, _>>();

    if vocabulary.is_empty() {
        return Err("The walkthrough has no word features to train.");
    }

    let responses = rows
        .iter()
        .map(|(response, _)| (*response).to_owned())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    let examples = rows
        .iter()
        .map(|(response, message)| Example {
            response: (*response).to_owned(),
            features: weighted_context_features(message, &vocabulary),
        })
        .collect::<Vec<_>>();

    let mut aggregate = [0.0; CONTROL_POINT_COUNT];
    let mut epochs_run = 0;

    for positive_response in &responses {
        let mut curves = HashMap::<Vec<usize>, SparseCurve>::new();
        let positive_examples = examples
            .iter()
            .filter(|example| &example.response == positive_response)
            .collect::<Vec<_>>();
        let terms = positive_examples
            .iter()
            .map(|example| active_terms(&example.features))
            .collect::<Vec<_>>();

        for epoch in 0..MAX_EPOCHS {
            let mut max_error = 0.0_f64;

            for active_terms in &terms {
                let prediction = active_terms
                    .iter()
                    .map(|term| {
                        curves
                            .get(&term.key)
                            .map(|curve| curve.value(term.value))
                            .unwrap_or(0.0)
                    })
                    .sum::<f64>();
                let error = 1.0 - prediction;
                max_error = max_error.max(error.abs());
                // Browser walkthrough paths can activate hundreds of terms.
                // Normalize the shared correction so their summed update has
                // the same scale as a small chatbot message.
                let term_error = error / active_terms.len().max(1) as f64;

                for term in active_terms {
                    curves
                        .entry(term.key.clone())
                        .or_insert_with(SparseCurve::new)
                        .train(term.value, term_error);
                }
            }

            epochs_run = epochs_run.max(epoch + 1);
            if epoch > 0 && max_error <= EPSILON {
                break;
            }
        }

        for curve in curves.values() {
            for (index, point) in curve.control_points.iter().enumerate() {
                aggregate[index] += point;
            }
        }
    }

    let points = aggregate
        .iter()
        .map(|point| format!("{point:.8}"))
        .collect::<Vec<_>>()
        .join(",");

    Ok(format!(
        "{{\"points\":[{points}],\"examples\":{},\"features\":{},\"classes\":{},\"epochs\":{epochs_run}}}",
        examples.len(),
        vocabulary.len(),
        responses.len()
    ))
}

fn weighted_context_features(
    message: &str,
    vocabulary: &BTreeMap<String, usize>,
) -> Vec<WeightedFeature> {
    let levels = message.split('\u{1e}').collect::<Vec<_>>();
    let mut features = BTreeMap::<usize, f64>::new();

    for (level_index, level) in levels.iter().enumerate() {
        let distance_from_parent = levels.len() - level_index - 1;
        let weight = CONTEXT_DECAY.powi(distance_from_parent as i32);

        for token in tokenize(level) {
            if let Some(index) = vocabulary.get(&token) {
                features
                    .entry(*index)
                    .and_modify(|current| *current = current.max(weight))
                    .or_insert(weight);
            }
        }
    }

    features
        .into_iter()
        .map(|(index, value)| WeightedFeature { index, value })
        .collect()
}

fn active_terms(features: &[WeightedFeature]) -> Vec<SparseTerm> {
    let mut terms = features
        .iter()
        .map(|feature| SparseTerm {
            key: vec![feature.index],
            value: feature.value,
        })
        .collect::<Vec<_>>();

    for left in 0..features.len() {
        for right in (left + 1)..features.len() {
            terms.push(SparseTerm {
                key: vec![features[left].index, features[right].index],
                value: features[left].value * features[right].value,
            });
        }
    }

    terms
}

fn tokenize(message: &str) -> Vec<String> {
    message
        .split(|character: char| !character.is_alphanumeric())
        .filter(|token| !token.is_empty())
        .map(str::to_lowercase)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trains_an_aggregate_phi_curve() {
        let report = train(
            "create user\tproduct\u{1e}accounts\ndelete user\tproduct\u{1e}accounts\ncreate invoice\tproduct\u{1e}billing",
        )
        .expect("training should succeed");

        assert!(report.contains("\"examples\":3"));
        assert!(report.contains("\"classes\":3"));
        assert!(report.contains("\"points\":["));
        assert!(!report.contains("NaN"));
    }

    #[test]
    fn weights_the_parent_more_than_the_root() {
        let vocabulary = ["accounts".to_string(), "product".to_string()]
            .into_iter()
            .enumerate()
            .map(|(index, token)| (token, index))
            .collect();
        let features = weighted_context_features("product\u{1e}accounts", &vocabulary);

        assert_eq!(features[0].value, 1.0);
        assert_eq!(features[1].value, CONTEXT_DECAY);
    }

    #[test]
    fn rejects_empty_text() {
        assert_eq!(
            train("\t\n"),
            Err("The walkthrough has no trainable feature text.")
        );
    }
}
