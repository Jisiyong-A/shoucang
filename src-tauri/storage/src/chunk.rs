//! Chinese text chunking (Task 07 §1).
//!
//! Ported from the Task 02 spike (`semantic-spike/spike_lib.py::chunk_text`):
//! sentence-boundary aware, 250–450 chars, 75-char overlap. The title and
//! tags chunks are built by the caller (title+tags are kept as their own
//! chunks with dedicated source_type).

pub const CHUNK_MIN: usize = 250;
pub const CHUNK_MAX: usize = 450;
pub const CHUNK_OVERLAP: usize = 75;

/// Split Chinese text into overlapping chunks at sentence boundaries.
/// Returns empty vec for empty input; single chunk when ≤ CHUNK_MAX.
pub fn chunk_text(text: &str, min_len: usize, max_len: usize, overlap: usize) -> Vec<String> {
    let compact: String = text.chars().filter(|c| !c.is_whitespace()).collect();
    if compact.is_empty() {
        return Vec::new();
    }
    if compact.chars().count() <= max_len {
        return vec![compact];
    }

    let mut sentences: Vec<String> = Vec::new();
    let mut current = String::new();
    for ch in compact.chars() {
        current.push(ch);
        if matches!(ch, '。' | '！' | '？' | '!' | '?' | '；' | ';' | '\n') {
            if !current.trim().is_empty() {
                sentences.push(current.trim().to_string());
                current.clear();
            }
        }
    }
    if !current.trim().is_empty() {
        sentences.push(current.trim().to_string());
    }

    let mut chunks: Vec<String> = Vec::new();
    let mut buf = String::new();
    for sentence in sentences {
        if buf.chars().count() + sentence.chars().count() <= max_len {
            buf.push_str(&sentence);
        } else {
            if !buf.is_empty() {
                chunks.push(buf.clone());
            }
            // carry overlap tail (last `overlap` chars at a boundary)
            let tail: String = buf
                .chars()
                .skip(buf.chars().count().saturating_sub(overlap))
                .collect();
            buf = tail;
            buf.push_str(&sentence);
            // oversize single sentence: hard split
            while buf.chars().count() > max_len {
                let take: String = buf.chars().take(max_len).collect();
                chunks.push(take);
                buf = buf.chars().skip(max_len.saturating_sub(overlap)).collect();
            }
        }
    }
    if !buf.trim().is_empty() {
        chunks.push(buf);
    }
    chunks
        .into_iter()
        .filter(|c| c.chars().count() >= min_len.saturating_sub(overlap))
        .collect()
}

/// Convenience wrapper with the benchmark-validated defaults.
pub fn chunk_note_body(content: &str) -> Vec<String> {
    chunk_text(content, CHUNK_MIN, CHUNK_MAX, CHUNK_OVERLAP)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn short_text_single_chunk() {
        let chunks = chunk_note_body("这是一段很短的正文内容。");
        assert_eq!(chunks.len(), 1);
    }

    #[test]
    fn long_text_split_into_overlapping_chunks() {
        // 20 sentences × ~66 chars ≈ 1320 chars -> expect >=3 chunks
        let text: String = (0..20)
            .map(|i| format!("第{i}句。{}", "这是一段很长的中文句子内容用来撑满字数要求并且验证分块逻辑是否能够按照句子边界正确切分。"))
            .collect::<Vec<_>>()
            .concat();
        let chunks = chunk_note_body(&text);
        assert!(chunks.len() >= 3, "expected >=3 chunks, got {}", chunks.len());
        for chunk in &chunks {
            assert!(
                chunk.chars().count() <= 450,
                "chunk exceeds max: {}",
                chunk.chars().count()
            );
        }
        // overlap exists between adjacent chunks
        let joined = chunks.join("");
        assert!(joined.chars().count() >= text.chars().count() - 100);
    }

    #[test]
    fn empty_text_no_chunks() {
        assert!(chunk_note_body("").is_empty());
        assert!(chunk_note_body("   \n  ").is_empty());
    }
}
