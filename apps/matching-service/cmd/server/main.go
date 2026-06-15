package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"

	"github.com/JosephP2001/uce-platform/matching-service/internal/consumer"
	"github.com/JosephP2001/uce-platform/matching-service/internal/handler"
	"github.com/JosephP2001/uce-platform/matching-service/internal/producer"
)

func main() {
	_ = godotenv.Load()

	// ── PostgreSQL ────────────────────────────────────────
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		getEnv("POSTGRES_HOST", "postgres"),
		getEnv("POSTGRES_PORT", "5432"),
		getEnv("POSTGRES_USER", "postgres"),
		getEnv("POSTGRES_PASSWORD", ""),
		getEnv("POSTGRES_DB", "jobs_db"),
	)

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("Failed to open DB: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping DB: %v", err)
	}
	log.Println("PostgreSQL connected")

	// ── RabbitMQ producer ─────────────────────────────────
	rabbitmqPassword := getEnv("RABBITMQ_PASSWORD", "")
	rabbitmqURL := fmt.Sprintf("amqp://admin:%s@rabbitmq:5672/", rabbitmqPassword)

	prod, err := producer.New(rabbitmqURL)
	if err != nil {
		log.Fatalf("Failed to connect to RabbitMQ: %v", err)
	}
	log.Println("RabbitMQ producer connected")

	// ── Kafka consumer ────────────────────────────────────
	kafkaBroker := getEnv("KAFKA_BROKER", "kafka:9092")

	cons, err := consumer.New(kafkaBroker, "matching-service-group", db, prod)
	if err != nil {
		log.Fatalf("Failed to create Kafka consumer: %v", err)
	}

	// ── HTTP health check ─────────────────────────────────
	port := getEnv("PORT", "3005")
	http.HandleFunc("/health", handler.Health)

	go func() {
		log.Printf("matching-service HTTP server on port %s\n", port)
		if err := http.ListenAndServe(":"+port, nil); err != nil {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	// ── Start consuming ───────────────────────────────────
	cons.Start()
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
