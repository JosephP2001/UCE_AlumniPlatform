package models

// JobCreatedEvent — received from Kafka topic job.created
type JobCreatedEvent struct {
	JobID   int    `json:"jobId"`
	Title   string `json:"title"`
	Company string `json:"company"`
}

// Profile — alumni profile from PostgreSQL
type Profile struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	Skills   string `json:"skills"`
	Career   string `json:"career"`
}

// MatchResult — published to RabbitMQ queue new_match
type MatchResult struct {
	JobID    int     `json:"jobId"`
	UserID   string  `json:"userId"`
	Username string  `json:"username"`
	Title    string  `json:"title"`
	Company  string  `json:"company"`
	Score    float64 `json:"score"`
}
