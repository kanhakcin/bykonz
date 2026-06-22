-- Add new conversation step enum values for the PDF report flow
ALTER TYPE "ConversationStep" ADD VALUE 'SELECT_EMPRESA_FOR_REPORT';
ALTER TYPE "ConversationStep" ADD VALUE 'AWAITING_REPORT_DATE';
