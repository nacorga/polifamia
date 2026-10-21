ALTER TYPE "public"."event_name" ADD VALUE 'selection_investigated';--> statement-breakpoint
ALTER TYPE "public"."failure_reason" ADD VALUE 'not_checkable';--> statement-breakpoint
ALTER TABLE "investigations" ADD COLUMN "manual_origin" text;