CREATE TYPE "public"."check_status" AS ENUM('verified', 'unverified', 'link_failed');--> statement-breakpoint
CREATE TYPE "public"."checkability" AS ENUM('CHECKABLE', 'NOT_CHECKABLE');--> statement-breakpoint
CREATE TYPE "public"."claim_type" AS ENUM('statistic', 'fact', 'opinion', 'prediction', 'uncheckable');--> statement-breakpoint
CREATE TYPE "public"."conclusion" AS ENUM('SUPPORTED', 'CONTRADICTED', 'NEEDS_CONTEXT', 'INSUFFICIENT_EVIDENCE');--> statement-breakpoint
CREATE TYPE "public"."corpus_status" AS ENUM('preparing_claims', 'claims_ready', 'transcript_unavailable');--> statement-breakpoint
CREATE TYPE "public"."event_name" AS ENUM('panel_opened', 'investigation_requested', 'result_opened', 'source_clicked', 'feedback_sent');--> statement-breakpoint
CREATE TYPE "public"."evidence_relation" AS ENUM('supports', 'contradicts', 'context', 'irrelevant');--> statement-breakpoint
CREATE TYPE "public"."failure_reason" AS ENUM('source_unavailable', 'budget_exceeded', 'provider_error', 'no_llm_key', 'timeout');--> statement-breakpoint
CREATE TYPE "public"."feedback_reason" AS ENUM('wrong_source', 'wrong_context', 'outdated', 'misquote', 'other');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('PENDING', 'RUNNING', 'COMPLETED', 'INSUFFICIENT_EVIDENCE', 'FAILED', 'CANCELED');--> statement-breakpoint
CREATE TYPE "public"."provenance" AS ENUM('declared_source', 'retrieved_evidence', 'unknown_origin');--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('primary', 'secondary', 'factcheck');--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"transcript_id" uuid NOT NULL,
	"literal" text NOT NULL,
	"context" text NOT NULL,
	"start_ms" integer NOT NULL,
	"end_ms" integer NOT NULL,
	"speaker" text,
	"claim_type" "claim_type" NOT NULL,
	"checkability" "checkability" NOT NULL,
	"normalized" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"declared_source" text,
	"rank" integer NOT NULL,
	"extractor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" "event_name" NOT NULL,
	"install_id" text NOT NULL,
	"video_id" text,
	"investigation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investigation_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"locator" text NOT NULL,
	"excerpt" text NOT NULL,
	"relation" "evidence_relation" NOT NULL,
	"provenance" "provenance" NOT NULL,
	"data_date" text,
	"accessed_at" timestamp with time zone NOT NULL,
	"check_status" "check_status" DEFAULT 'unverified' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investigation_id" uuid NOT NULL,
	"investigation_version" integer NOT NULL,
	"reason" "feedback_reason" NOT NULL,
	"comment" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investigations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid,
	"manual_text" text,
	"version" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"cache_key" text NOT NULL,
	"status" "job_status" DEFAULT 'PENDING' NOT NULL,
	"conclusion" "conclusion",
	"summary" text,
	"context" text,
	"limitations" text,
	"stats" jsonb,
	"failure_reason" "failure_reason",
	"is_demo" boolean NOT NULL,
	"pipeline_version" text,
	"models" jsonb,
	"cost_eur" numeric(10, 5) DEFAULT 0 NOT NULL,
	"latency_ms" integer,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"checked_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"superseded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "investigations_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "investigations_claim_xor_manual" CHECK (("investigations"."claim_id" IS NULL) <> ("investigations"."manual_text" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_url" text NOT NULL,
	"title" text NOT NULL,
	"publisher" text NOT NULL,
	"published_at" text,
	"kind" "source_kind" NOT NULL,
	"terms" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_canonical_url_unique" UNIQUE("canonical_url")
);
--> statement-breakpoint
CREATE TABLE "transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"segments" jsonb NOT NULL,
	"revision_hash" text NOT NULL,
	"rights" jsonb NOT NULL,
	"source_format" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"youtube_id" text NOT NULL,
	"title" text,
	"channel" text,
	"language" text NOT NULL,
	"published_at" date,
	"corpus_status" "corpus_status" NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "videos_youtube_id_unique" UNIQUE("youtube_id")
);
--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_transcript_id_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."transcripts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investigations" ADD CONSTRAINT "investigations_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "claims_video_idx" ON "claims" USING btree ("video_id","rank");--> statement-breakpoint
CREATE INDEX "events_created_idx" ON "events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "investigations_claim_version_idx" ON "investigations" USING btree ("claim_id","version");--> statement-breakpoint
CREATE INDEX "investigations_status_idx" ON "investigations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "investigations_cache_key_idx" ON "investigations" USING btree ("cache_key");--> statement-breakpoint
CREATE UNIQUE INDEX "investigations_inflight_uq" ON "investigations" USING btree ("cache_key") WHERE "investigations"."status" IN ('PENDING', 'RUNNING');--> statement-breakpoint
CREATE UNIQUE INDEX "transcripts_video_revision_uq" ON "transcripts" USING btree ("video_id","revision_hash");