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
const MAX_DEGREE: usize = 2;

static mut RESULT_POINTER: *mut u8 = std::ptr::null_mut();
static mut RESULT_LENGTH: usize = 0;

#[derive(Clone, Debug)]
struct Example {
    response: String,
    target: f64,
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

struct BinaryReader<'a> {
    bytes: &'a [u8],
    position: usize,
}

impl<'a> BinaryReader<'a> {
    fn new(bytes: &'a [u8]) -> Self {
        Self { bytes, position: 0 }
    }

    fn take(&mut self, length: usize) -> Result<&'a [u8], &'static str> {
        let end = self
            .position
            .checked_add(length)
            .ok_or("The binary Phi model length is invalid.")?;
        if end > self.bytes.len() {
            return Err("The binary Phi model is truncated.");
        }
        let value = &self.bytes[self.position..end];
        self.position = end;
        Ok(value)
    }

    fn uint8(&mut self) -> Result<u8, &'static str> {
        Ok(self.take(1)?[0])
    }

    fn uint16(&mut self) -> Result<u16, &'static str> {
        let bytes = self.take(2)?;
        Ok(u16::from_le_bytes([bytes[0], bytes[1]]))
    }

    fn uint32(&mut self) -> Result<u32, &'static str> {
        let bytes = self.take(4)?;
        Ok(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
    }

    fn float32(&mut self) -> Result<f32, &'static str> {
        let bytes = self.take(4)?;
        let value = f32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
        if !value.is_finite() {
            return Err("The binary Phi model contains a non-finite curve point.");
        }
        Ok(value)
    }

    fn string(&mut self) -> Result<&'a str, &'static str> {
        let length = self.uint8()? as usize;
        std::str::from_utf8(self.take(length)?)
            .map_err(|_| "The binary Phi vocabulary is not valid UTF-8.")
    }

    fn is_finished(&self) -> bool {
        self.position == self.bytes.len()
    }
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
    train_request(pointer, length, false);
}

#[no_mangle]
pub unsafe extern "C" fn train_model(pointer: *const u8, length: usize) {
    train_request(pointer, length, true);
}

unsafe fn train_request(pointer: *const u8, length: usize, include_model: bool) {
    let result = if pointer.is_null() || length == 0 {
        Err("The walkthrough has no feature text to train.")
    } else {
        std::str::from_utf8(std::slice::from_raw_parts(pointer, length))
            .map_err(|_| "The walkthrough text is not valid UTF-8.")
            .and_then(|input| train(input, include_model))
    };

    store_result(match result {
        Ok(report) => report,
        Err(message) => format!("{{\"error\":\"{message}\"}}"),
    });
}

#[no_mangle]
pub unsafe extern "C" fn parse_model(pointer: *const u8, length: usize) {
    let result = if pointer.is_null() || length == 0 {
        Err("The binary Phi model is empty.")
    } else {
        parse_binary_model(std::slice::from_raw_parts(pointer, length))
    };
    store_result(match result {
        Ok(model) => model,
        Err(message) => format!("{{\"error\":\"{message}\"}}"),
    });
}

unsafe fn store_result(json: String) {
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

fn parse_binary_model(input: &[u8]) -> Result<String, &'static str> {
    let mut reader = BinaryReader::new(input);
    if reader.take(8)? != b"PHICRV10" {
        return Err("The binary Phi model has an unsupported format.");
    }
    let degree = reader.uint8()? as usize;
    let point_count = reader.uint8()? as usize;
    let vocabulary_count = reader.uint16()? as usize;
    let response_count = reader.uint8()? as usize;
    if degree != MAX_DEGREE || point_count != CONTROL_POINT_COUNT {
        return Err("The binary Phi model dimensions are unsupported.");
    }
    if vocabulary_count == 0 || vocabulary_count > u8::MAX as usize || response_count == 0 {
        return Err("The binary Phi model has invalid response dimensions.");
    }

    let examples = reader.uint32()?;
    let epochs = reader.uint32()?;
    let aggregate = read_curve(&mut reader)?;
    let positions = reader.uint32()?;
    let training_examples = reader.uint32()?;
    let sampled_positions = reader.uint32()?;
    let avoidable_loss_positions = reader.uint32()?;
    let max_positions_per_ply = reader.uint16()?;
    let win_target = reader.float32()?;
    let avoid_loss_target = reader.float32()?;
    let pat_target = reader.float32()?;
    let loss_target = reader.float32()?;
    let wins = reader.uint32()?;
    let avoid_losses = reader.uint32()?;
    let pats = reader.uint32()?;
    let losses = reader.uint32()?;

    let vocabulary = (0..vocabulary_count)
        .map(|_| reader.string().map(json_string))
        .collect::<Result<Vec<_>, _>>()?;
    let mut responses = Vec::with_capacity(response_count);
    for _ in 0..response_count {
        let response = reader.uint8()?;
        if !(1..=9).contains(&response) {
            return Err("The binary Phi model contains an invalid response.");
        }
        let term_count = reader.uint32()? as usize;
        let mut terms = Vec::with_capacity(term_count);
        for _ in 0..term_count {
            let feature_count = reader.uint8()? as usize;
            if feature_count == 0 || feature_count > degree {
                return Err("The binary Phi model contains an invalid sparse term.");
            }
            let mut features = Vec::with_capacity(feature_count);
            for _ in 0..feature_count {
                let feature = reader.uint8()? as usize;
                if feature >= vocabulary_count {
                    return Err("The binary Phi term references an unknown feature.");
                }
                features.push(feature.to_string());
            }
            let point_mask = reader.uint8()?;
            let curve = (0..CONTROL_POINT_COUNT)
                .map(|index| {
                    if point_mask & (1 << index) == 0 {
                        Ok("0.00000000".to_owned())
                    } else {
                        reader.float32().map(|point| format!("{point:.8}"))
                    }
                })
                .collect::<Result<Vec<_>, _>>()?
                .join(",");
            terms.push(format!("[[{}],[{}]]", features.join(","), curve));
        }
        responses.push(format!(
            "{{\"response\":\"{response}\",\"terms\":[{}]}}",
            terms.join(",")
        ));
    }
    if !reader.is_finished() {
        return Err("The binary Phi model contains trailing data.");
    }

    Ok(format!(
        "{{\"format\":\"tic-tac-toe-phi/v10\",\"implementation\":\"phi_walkthrough_bg.wasm\",\"board\":{{\"cells\":\"nine X, O, or . cells in reading order\",\"moves\":\"1-9 in reading order\",\"history\":\"ordered board snapshots with ancestry decay\",\"inference\":\"apply Phi to the encoded board and return the highest-scoring legal response\"}},\"points\":[{aggregate}],\"examples\":{examples},\"features\":{vocabulary_count},\"classes\":{response_count},\"epochs\":{epochs},\"vocabulary\":[{}],\"phi\":{{\"kind\":\"weighted sparse curve function\",\"degree\":{degree},\"input\":\"one-hot board feature vector\",\"inputDimension\":{vocabulary_count},\"result\":\"response score vector\",\"resultDimension\":{response_count},\"training\":\"outcome-weighted positive responses using the walkthrough weighted sparse curve learner\",\"responses\":[{}]}},\"training\":{{\"strategy\":\"all legal moves with outcome-weighted targets and exhaustive O avoidable-loss coverage\",\"positions\":{positions},\"examples\":{training_examples},\"sampledPositions\":{sampled_positions},\"avoidableLossPositions\":{avoidable_loss_positions},\"maxPositionsPerPly\":{max_positions_per_ply},\"targets\":{{\"win\":{win_target},\"avoidLoss\":{avoid_loss_target},\"pat\":{pat_target},\"loss\":{loss_target}}},\"outcomes\":{{\"wins\":{wins},\"avoidLosses\":{avoid_losses},\"pats\":{pats},\"losses\":{losses}}}}}}}",
        vocabulary.join(","),
        responses.join(",")
    ))
}

fn read_curve(reader: &mut BinaryReader) -> Result<String, &'static str> {
    (0..CONTROL_POINT_COUNT)
        .map(|_| reader.float32().map(|point| format!("{point:.8}")))
        .collect::<Result<Vec<_>, _>>()
        .map(|points| points.join(","))
}

fn train(input: &str, include_model: bool) -> Result<String, &'static str> {
    let rows = input
        .lines()
        .filter_map(|line| {
            let mut fields = line.splitn(3, '\t');
            let response = fields.next()?.trim();
            let second = fields.next()?.trim();
            let third = fields.next();
            let (target, message) = if include_model && third.is_some() {
                (second.parse::<f64>().ok()?, third.unwrap().trim())
            } else {
                (1.0, second)
            };
            (!response.is_empty() && !message.is_empty() && (0.0..=1.0).contains(&target))
                .then_some((response, target, message))
        })
        .collect::<Vec<_>>();

    if rows.is_empty() {
        return Err("The walkthrough has no trainable feature text.");
    }

    let vocabulary = rows
        .iter()
        .flat_map(|(_, _, message)| {
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
        .map(|(response, _, _)| (*response).to_owned())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    let examples = rows
        .iter()
        .map(|(response, target, message)| Example {
            response: (*response).to_owned(),
            target: *target,
            features: weighted_context_features(message, &vocabulary),
        })
        .collect::<Vec<_>>();

    let mut aggregate = [0.0; CONTROL_POINT_COUNT];
    let mut epochs_run = 0;
    let mut response_models = Vec::new();

    for positive_response in &responses {
        let mut curves = HashMap::<Vec<usize>, SparseCurve>::new();
        let terms = examples
            .iter()
            .filter(|example| &example.response == positive_response)
            .map(|example| (example.target, active_terms(&example.features)))
            .collect::<Vec<_>>();

        for epoch in 0..MAX_EPOCHS {
            let mut max_error = 0.0_f64;

            for (target, active_terms) in &terms {
                let prediction = active_terms
                    .iter()
                    .map(|term| {
                        curves
                            .get(&term.key)
                            .map(|curve| curve.value(term.value))
                            .unwrap_or(0.0)
                    })
                    .sum::<f64>();
                let error = target - prediction;
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

        if include_model {
            let mut entries = curves.iter().collect::<Vec<_>>();
            entries.sort_by(|(left, _), (right, _)| left.cmp(right));
            let serialized_curves = entries
                .iter()
                .map(|(key, curve)| {
                    let features = key
                        .iter()
                        .map(usize::to_string)
                        .collect::<Vec<_>>()
                        .join(",");
                    format!(
                        "{{\"features\":[{features}],\"points\":[{}]}}",
                        serialize_points(&curve.control_points)
                    )
                })
                .collect::<Vec<_>>()
                .join(",");
            response_models.push(format!(
                "{{\"response\":{},\"curves\":[{serialized_curves}]}}",
                json_string(positive_response)
            ));
        }
    }

    let points = serialize_points(&aggregate);
    let model = if include_model {
        let mut vocabulary_by_index = vocabulary.iter().collect::<Vec<_>>();
        vocabulary_by_index.sort_by_key(|(_, index)| **index);
        let serialized_vocabulary = vocabulary_by_index
            .iter()
            .map(|(token, _)| json_string(token))
            .collect::<Vec<_>>()
            .join(",");
        format!(
            ",\"vocabulary\":[{serialized_vocabulary}],\"phi\":{{\"degree\":{MAX_DEGREE},\"responses\":[{}]}}",
            response_models.join(",")
        )
    } else {
        String::new()
    };

    Ok(format!(
        "{{\"points\":[{points}],\"examples\":{},\"features\":{},\"classes\":{},\"epochs\":{epochs_run}{model}}}",
        examples.len(),
        vocabulary.len(),
        responses.len()
    ))
}

fn serialize_points(points: &[f64; CONTROL_POINT_COUNT]) -> String {
    points
        .iter()
        .map(|point| format!("{point:.8}"))
        .collect::<Vec<_>>()
        .join(",")
}

fn json_string(value: &str) -> String {
    let mut output = String::from("\"");
    for character in value.chars() {
        match character {
            '"' => output.push_str("\\\""),
            '\\' => output.push_str("\\\\"),
            '\n' => output.push_str("\\n"),
            '\r' => output.push_str("\\r"),
            '\t' => output.push_str("\\t"),
            character if character.is_control() => {
                output.push_str(&format!("\\u{:04x}", character as u32));
            }
            character => output.push(character),
        }
    }
    output.push('"');
    output
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
    let mut terms = Vec::new();
    let mut selected = Vec::new();

    for degree in 1..=MAX_DEGREE.min(features.len()) {
        collect_terms(features, degree, 0, &mut selected, 1.0, &mut terms);
    }

    terms
}

fn collect_terms(
    features: &[WeightedFeature],
    remaining: usize,
    start: usize,
    selected: &mut Vec<usize>,
    value: f64,
    terms: &mut Vec<SparseTerm>,
) {
    if remaining == 0 {
        terms.push(SparseTerm {
            key: selected.clone(),
            value,
        });
        return;
    }

    for position in start..features.len() {
        selected.push(features[position].index);
        collect_terms(
            features,
            remaining - 1,
            position + 1,
            selected,
            value * features[position].value,
            terms,
        );
        selected.pop();
    }
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
            false,
        )
        .expect("training should succeed");

        assert!(report.contains("\"examples\":3"));
        assert!(report.contains("\"classes\":3"));
        assert!(report.contains("\"points\":["));
        assert!(!report.contains("NaN"));
    }

    #[test]
    fn exports_a_playable_phi_function() {
        let report = train(
            "5\tturnx cell1empty cell2empty\n9\tturnx cell1x cell2empty",
            true,
        )
        .expect("training should succeed");

        assert!(report.contains("\"vocabulary\":["));
        assert!(report.contains("\"phi\":{\"degree\":2,\"responses\":["));
        assert!(report.contains("\"response\":\"5\""));
        assert!(report.contains("\"features\":["));
        assert!(report.contains("\"points\":["));
    }

    #[test]
    fn exported_model_uses_the_same_weighted_sparse_training() {
        let input = "5\troot\u{1e}center\n9\troot\u{1e}corner";
        let plot_report = train(input, false).expect("plot training should succeed");
        let model_report = train(input, true).expect("model training should succeed");
        let plot_points = plot_report
            .split("\"points\":[")
            .nth(1)
            .and_then(|value| value.split(']').next())
            .unwrap();
        let model_points = model_report
            .split("\"points\":[")
            .nth(1)
            .and_then(|value| value.split(']').next())
            .unwrap();

        assert_eq!(plot_points, model_points);
    }

    #[test]
    fn model_export_honors_decayed_response_targets() {
        let report = train("5\t0.65\tcenter", true).expect("weighted training should succeed");
        let final_point = report
            .strip_prefix("{\"points\":[")
            .and_then(|value| value.split(']').next())
            .and_then(|points| points.rsplit(',').next())
            .and_then(|point| point.parse::<f64>().ok())
            .unwrap();

        assert!(final_point > 0.60 && final_point <= 0.65);
    }

    #[test]
    fn model_export_learns_from_zero_target_loss_examples() {
        let report = train("5\t1\tshared good\n5\t0\tshared bad", true)
            .expect("contrasting training should succeed");

        assert!(report.contains("-0."));
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
    fn creates_linear_and_pairwise_terms() {
        let features = vec![
            WeightedFeature {
                index: 1,
                value: 1.0,
            },
            WeightedFeature {
                index: 2,
                value: 0.5,
            },
            WeightedFeature {
                index: 3,
                value: 0.25,
            },
        ];
        let terms = active_terms(&features);

        assert_eq!(terms.len(), 6);
        assert!(terms.iter().all(|term| term.key.len() <= 2));
        assert_eq!(terms.last().unwrap().key, vec![2, 3]);
        assert_eq!(terms.last().unwrap().value, 0.125);
    }

    #[test]
    fn rejects_empty_text() {
        assert_eq!(
            train("\t\n", false),
            Err("The walkthrough has no trainable feature text.")
        );
    }
}
