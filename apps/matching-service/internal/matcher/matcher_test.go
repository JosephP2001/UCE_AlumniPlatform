package matcher

import (
	"testing"
)

func TestCosineSimilarity_IdenticalTexts(t *testing.T) {
	score := CosineSimilarity("node typescript docker aws", "node typescript docker aws")
	if score != 1.0 {
		t.Errorf("expected 1.0 for identical texts, got %f", score)
	}
}

func TestCosineSimilarity_NoOverlap(t *testing.T) {
	score := CosineSimilarity("golang kubernetes", "photoshop illustrator")
	if score != 0.0 {
		t.Errorf("expected 0.0 for no overlap, got %f", score)
	}
}

func TestCosineSimilarity_PartialOverlap(t *testing.T) {
	score := CosineSimilarity("node typescript docker", "node python docker")
	if score <= 0.0 || score >= 1.0 {
		t.Errorf("expected partial score between 0 and 1, got %f", score)
	}
}

func TestCosineSimilarity_EmptyStrings(t *testing.T) {
	score := CosineSimilarity("", "node typescript")
	if score != 0.0 {
		t.Errorf("expected 0.0 for empty string, got %f", score)
	}
}

func TestCosineSimilarity_CaseInsensitive(t *testing.T) {
	score1 := CosineSimilarity("Node TypeScript", "node typescript")
	score2 := CosineSimilarity("node typescript", "node typescript")
	if score1 != score2 {
		t.Errorf("case sensitivity mismatch: %f vs %f", score1, score2)
	}
}

func TestScoreThreshold(t *testing.T) {
	if ScoreThreshold <= 0.0 || ScoreThreshold >= 1.0 {
		t.Errorf("ScoreThreshold %f out of valid range", ScoreThreshold)
	}
}
