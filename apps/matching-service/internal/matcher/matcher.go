package matcher

import (
	"math"
	"strings"
)

// termFrequency builds a word frequency map from text
func termFrequency(text string) map[string]float64 {
	tf := make(map[string]float64)
	words := strings.Fields(strings.ToLower(text))
	for _, w := range words {
		tf[w]++
	}
	return tf
}

// CosineSimilarity computes cosine similarity between two text strings.
// Returns a score between 0.0 (no match) and 1.0 (identical).
func CosineSimilarity(a, b string) float64 {
	if a == "" || b == "" {
		return 0.0
	}

	tfA := termFrequency(a)
	tfB := termFrequency(b)

	// Build union vocabulary
	vocab := make(map[string]struct{})
	for w := range tfA {
		vocab[w] = struct{}{}
	}
	for w := range tfB {
		vocab[w] = struct{}{}
	}

	var dotProduct, magA, magB float64
	for w := range vocab {
		a := tfA[w]
		b := tfB[w]
		dotProduct += a * b
		magA += a * a
		magB += b * b
	}

	if magA == 0 || magB == 0 {
		return 0.0
	}

	return dotProduct / (math.Sqrt(magA) * math.Sqrt(magB))
}

// ScoreThreshold — minimum score to consider a match worth publishing
const ScoreThreshold = 0.1
