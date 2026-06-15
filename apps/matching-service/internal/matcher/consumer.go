package consumer

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"

	"github.com/JosephP2001/uce-platform/matching-service/internal/matcher"
	"github.com/JosephP2001/uce-platform/matching-service/internal/producer"
	"github.com/JosephP2001/uce-platform/matching-service/pkg/models"
)

type KafkaConsumer struct {
	consumer *kafka.Consumer
	db       *sql.DB
	producer *producer.RabbitMQProducer
}

func New(brokers, groupID string, db *sql.DB, prod *producer.RabbitMQProducer) (*KafkaConsumer, error) {
	c, err := kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers": brokers,
		"group.id":          groupID,
		"auto.offset.reset": "earliest",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create Kafka consumer: %w", err)
	}

	if err := c.SubscribeTopics([]string{"job.created"}, nil); err != nil {
		return nil, fmt.Errorf("failed to subscribe: %w", err)
	}

	return &KafkaConsumer{consumer: c, db: db, producer: prod}, nil
}

func (kc *KafkaConsumer) Start() {
	sigchan := make(chan os.Signal, 1)
	signal.Notify(sigchan, syscall.SIGINT, syscall.SIGTERM)

	log.Println("matching-service: Kafka consumer started, waiting for job.created events...")

	for {
		select {
		case sig := <-sigchan:
			log.Printf("Caught signal %v, shutting down\n", sig)
			kc.consumer.Close()
			return
		default:
			msg, err := kc.consumer.ReadMessage(100)
			if err != nil {
				// Timeout is normal — just continue
				if kafkaErr, ok := err.(kafka.Error); ok && kafkaErr.Code() == kafka.ErrTimedOut {
					continue
				}
				log.Printf("Kafka read error: %v\n", err)
				continue
			}

			kc.handleMessage(msg)
		}
	}
}

func (kc *KafkaConsumer) handleMessage(msg *kafka.Message) {
	var event models.JobCreatedEvent
	if err := json.Unmarshal(msg.Value, &event); err != nil {
		log.Printf("Failed to unmarshal job.created event: %v\n", err)
		return
	}

	log.Printf("Received job.created: jobId=%d title=%s company=%s\n",
		event.JobID, event.Title, event.Company)

	// Fetch all profiles from PostgreSQL
	profiles, err := kc.fetchProfiles()
	if err != nil {
		log.Printf("Failed to fetch profiles: %v\n", err)
		return
	}

	// Score each profile against the job title + company
	jobText := event.Title + " " + event.Company
	matched := 0

	for _, profile := range profiles {
		profileText := profile.Skills + " " + profile.Career
		score := matcher.CosineSimilarity(jobText, profileText)

		if score >= matcher.ScoreThreshold {
			match := models.MatchResult{
				JobID:    event.JobID,
				UserID:   profile.UserID,
				Username: profile.Username,
				Title:    event.Title,
				Company:  event.Company,
				Score:    score,
			}

			if err := kc.producer.PublishMatch(match); err != nil {
				log.Printf("Failed to publish match: %v\n", err)
			} else {
				log.Printf("Match published: userId=%s score=%.3f\n", profile.UserID, score)
				matched++
			}
		}
	}

	log.Printf("job.created processed: jobId=%d profiles=%d matched=%d\n",
		event.JobID, len(profiles), matched)
}

func (kc *KafkaConsumer) fetchProfiles() ([]models.Profile, error) {
	rows, err := kc.db.Query(
		`SELECT user_id, COALESCE(username,''), COALESCE(skills,''), COALESCE(career,'')
		 FROM profiles`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var profiles []models.Profile
	for rows.Next() {
		var p models.Profile
		if err := rows.Scan(&p.UserID, &p.Username, &p.Skills, &p.Career); err != nil {
			return nil, err
		}
		profiles = append(profiles, p)
	}
	return profiles, nil
}
