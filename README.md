# Silo Data Report Generation Service

A Node.js service that generates Excel reports with hourly aggregated data for silos, using S3 for report storage.

## Architecture Overview

The service consists of:

- Node.js Express backend
- MySQL database for data storage and job tracking
- AWS S3 for report storage
- Docker containers for local development

### Key Components

1. **Backend Service (Node.js/Express)**

   - Handles API requests for report generation and status checking
   - Manages report generation jobs
   - Interacts with MySQL database and AWS S3
   - Provides OpenAPI documentation

2. **Database (MySQL)**

   - Stores raw silo data
   - Maintains hourly aggregated data
   - Tracks report generation jobs

3. **Storage (AWS S3)**
   - Stores generated Excel reports
   - Provides secure access to reports via pre-signed URLs

## API Endpoints

### POST /api/initiate-silo-report

Initiates a new report generation job.

**Response:**

```json
{
  "jobId": "uuid",
  "status": "PENDING|PROCESSING|COMPLETED|FAILED",
  "s3Url": "https://...", // Only present when status is COMPLETED
  "errorMessage": "..." // Only present when status is FAILED
}
```

### GET /api/silo-report-status/:jobId

Retrieves the status of a report generation job.

**Response:**

```json
{
  "jobId": "uuid",
  "status": "PENDING|PROCESSING|COMPLETED|FAILED",
  "s3Url": "https://...", // Only present when status is COMPLETED
  "errorMessage": "...", // Only present when status is FAILED
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

## Database Schema

### report_jobs

Tracks report generation jobs:

```sql
CREATE TABLE report_jobs (
    job_id VARCHAR(255) PRIMARY KEY,
    status ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL,
    s3_url VARCHAR(1024) NULL,
    error_message TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### silo_hourly_aggregates

Stores pre-aggregated hourly data:

```sql
CREATE TABLE silo_hourly_aggregates (
    silo_id INT NOT NULL,
    hour_timestamp TIMESTAMP NOT NULL,
    avg_value DECIMAL(10, 2),
    min_value DECIMAL(10, 2),
    max_value DECIMAL(10, 2),
    sum_value DECIMAL(10, 2),
    record_count INT,
    PRIMARY KEY (silo_id, hour_timestamp)
);
```

## Development Setup

### Prerequisites

- Node.js 18 or later
- Docker and Docker Compose
- AWS account with S3 access
- MySQL (provided via Docker)

### Environment Variables

Create a `.env` file in the backend directory:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=mysql
DB_PORT=3306
DB_USER=root
DB_PASSWORD=rootpassword
DB_NAME=report_db

# AWS
AWS_REGION=your-region
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name
```

### Running Locally

1. Start the services:
   ```bash
   docker-compose up
   ```
2. The API will be available at `http://localhost:3000/api`
3. API documentation is available at `http://localhost:3000/api-docs`

### Database Setup

The database tables are automatically created when the application starts. For manual setup:

```bash
node src/scripts/create-tables.js
```

## Report Generation Process

1. **Job Initiation**

   - Client requests report generation via POST `/api/initiate-silo-report`
   - System creates a new job record with status `PENDING`
   - Report generation starts asynchronously

2. **Data Processing**

   - System queries aggregated data from `silo_hourly_aggregates`
   - Generates Excel report using ExcelJS
   - Uploads report to S3
   - Updates job status to `COMPLETED` with S3 URL

3. **Status Tracking**
   - Client polls GET `/api/silo-report-status/:jobId`
   - System returns current job status and report URL when ready

## Monitoring

The service uses Winston for logging:

- Console logging for development
- File logging for production
- Log files are stored in the `logs` directory

## Error Handling

- All errors are logged with appropriate context
- API errors return standardized error responses
- Failed jobs are marked with error messages
- Development environment includes detailed error messages

## Security

- AWS credentials are managed via environment variables
- S3 URLs are pre-signed and time-limited
- Database credentials are secured via environment variables
- CORS is enabled for API access

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License.
