package main

import (
	"context"
	"log"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
)

// TestMain spins up a PostgreSQL 17 container before the test suite runs,
// sets TEST_DB_URL so all integration tests pick it up, then tears it down.
// If Docker is unavailable, it falls back gracefully: unit tests still run
// and integration tests skip via the existing TEST_DB_URL guard in newTestApp.
func TestMain(m *testing.M) {
	os.Exit(runWithContainer(m))
}

func runWithContainer(m *testing.M) int {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	ddlPath, err := filepath.Abs(filepath.Join("docker", "ddl.sql"))
	if err != nil {
		log.Printf("testcontainers: could not resolve DDL path: %v — integration tests will skip", err)
		return m.Run()
	}

	pgContainer, err := postgres.Run(ctx,
		"docker.io/postgres:17",
		postgres.WithDatabase("testdb"),
		postgres.WithUsername("testuser"),
		postgres.WithPassword("testpass"),
		postgres.WithInitScripts(ddlPath),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(60*time.Second),
		),
	)
	if err != nil {
		log.Printf("testcontainers: PostgreSQL unavailable (%v) — integration tests will skip", err)
		return m.Run()
	}
	defer func() {
		if terr := pgContainer.Terminate(ctx); terr != nil {
			log.Printf("testcontainers: terminate: %v", terr)
		}
	}()

	connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		log.Printf("testcontainers: ConnectionString: %v — integration tests will skip", err)
		return m.Run()
	}

	os.Setenv("TEST_DB_URL", connStr)
	return m.Run()
}
