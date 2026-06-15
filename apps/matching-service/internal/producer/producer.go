package producer

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"

	"matching-service/pkg/models"
)

type RabbitMQProducer struct {
	channel *amqp.Channel
	queue   string
}

func New(rabbitmqURL string) (*RabbitMQProducer, error) {
	var conn *amqp.Connection
	var err error

	for i := 0; i < 10; i++ {
		conn, err = amqp.Dial(rabbitmqURL)
		if err == nil {
			break
		}
		fmt.Printf("RabbitMQ not ready, retry %d/10: %v\n", i+1, err)
		time.Sleep(3 * time.Second)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		return nil, fmt.Errorf("failed to open channel: %w", err)
	}

	_, err = ch.QueueDeclare("new_match", true, false, false, false, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to declare queue: %w", err)
	}

	return &RabbitMQProducer{channel: ch, queue: "new_match"}, nil
}

func (p *RabbitMQProducer) PublishMatch(match models.MatchResult) error {
	body, err := json.Marshal(match)
	if err != nil {
		return fmt.Errorf("failed to marshal match: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	return p.channel.PublishWithContext(ctx,
		"",
		p.queue,
		false,
		false,
		amqp.Publishing{
			ContentType:  "application/json",
			Body:         body,
			DeliveryMode: amqp.Persistent,
		},
	)
}