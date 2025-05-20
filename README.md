# Plan: Silo Data Aggregate Report Feature Implementation

**Goal:** Generate an on-demand Excel report with hourly aggregated data for each of 6 silos, without overloading the existing Node.js server.

**Target Architecture:** Asynchronous Serverless Processing with Pre-Aggregation using AWS Lambda, S3, and MySQL.

---

## Phase 1: Prerequisites & Initial Setup

1.  **AWS Account & CLI Setup:**
    - Ensure AWS account access with necessary permissions to create IAM roles, Lambda functions, S3 buckets, and CloudWatch Events.
    - Configure AWS CLI locally for easier resource management and deployment.
2.  **Project Repository:**
    - Set up or identify a Git repository for the new Lambda functions and any backend modifications.
3.  **Local Development Environment:**
    - Ensure Node.js (for Lambda development) and necessary tools (e.g., Serverless Framework, AWS SAM CLI - optional but recommended for Lambda management) are installed.
    - Set up local MySQL access for development and testing.
4.  **Define Excel Report Structure:**
    - Finalize the exact columns, sheets (one per silo or combined), and formatting for the Excel report. This will guide the `ReportGeneratorLambda` development.

---

## Phase 2: Database Modifications

1.  **Create `report_jobs` Table:**
    - **Purpose:** Track the status of report generation requests.
    - **Schema:**
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
2.  **Create `silo_hourly_aggregates` Table:**
    - **Purpose:** Store pre-aggregated hourly data.
    - **Schema (Example - adjust metrics as needed):**
      ```sql
      CREATE TABLE silo_hourly_aggregates (
          silo_id INT NOT NULL,
          hour_timestamp TIMESTAMP NOT NULL, -- e.g., 2025-05-19 14:00:00
          avg_value DECIMAL(10, 2),
          min_value DECIMAL(10, 2),
          max_value DECIMAL(10, 2),
          sum_value DECIMAL(10, 2),
          record_count INT,
          PRIMARY KEY (silo_id, hour_timestamp),
          FOREIGN KEY (silo_id) REFERENCES silos(id) -- Assuming a 'silos' table
      );
      ```
    - **Indexing:** Ensure `PRIMARY KEY (silo_id, hour_timestamp)` is created. Consider additional indexes if queries involve other columns frequently.
3.  **Review Existing Time-Series Table:**
    - Ensure proper indexing on `timestamp` and `silo_id` columns for efficient querying.

---

## Phase 3: AWS Infrastructure Setup

1.  **S3 Bucket for Reports:**
    - Create an S3 bucket (e.g., `your-company-silo-reports`).
    - Configure appropriate permissions (private by default).
    - Set up a lifecycle policy (e.g., delete reports older than 30/60/90 days).
2.  **IAM Roles:**
    - **`HourlyAggregatorLambdaRole`:**
      - Permissions:
        - `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` (CloudWatch Logs).
        - MySQL access (permissions to read raw data and write to `silo_hourly_aggregates`). This will depend on your DB setup (RDS security groups, VPC, etc.).
    - **`ReportGeneratorLambdaRole`:**
      - Permissions:
        - `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents`.
        - MySQL access (read from `silo_hourly_aggregates`, read raw data, read/write to `report_jobs`).
        - S3: `s3:PutObject`, `s3:GetObject` (for the reports bucket).
3.  **VPC Configuration (If MySQL is in a VPC):**
    - Ensure Lambda functions can access the MySQL database. This might involve:
      - Placing Lambdas in the same VPC.
      - Configuring security groups to allow traffic from Lambdas to the DB.
      - Using NAT Gateway if Lambdas need internet access (e.g., for AWS SDK calls if not using VPC endpoints).

---

## Phase 4: Backend Development (Legacy Node.js Server)

1.  **Install AWS SDK:**
    - If not already present: `npm install aws-sdk`
2.  **Develop API Endpoint: `POST /initiate-silo-report`**
    - **Logic:**
      1.  Receive request from frontend.
      2.  Generate a unique `jobId` (e.g., using `uuid`).
      3.  Insert a new record into `report_jobs` with `status = 'PENDING'`.
      4.  Asynchronously invoke `ReportGeneratorLambda` (e.g., using `lambda.invoke` with `InvocationType: 'Event'`). Pass the `jobId` in the payload.
      5.  Return `{ jobId, status: 'PENDING' }` to the frontend.
    - **Error Handling:** Handle database errors, Lambda invocation errors.
3.  **Develop API Endpoint: `GET /silo-report-status/:jobId`**
    - **Logic:**
      1.  Receive `jobId` from path parameter.
      2.  Query `report_jobs` table for the status and `s3_url` for the given `jobId`.
      3.  Return `{ status, s3Url (if COMPLETED) }`.
    - **Error Handling:** Handle database errors, job not found.

---

## Phase 5: AWS Lambda Development - `HourlyAggregatorLambda`

1.  **Function Setup:**
    - Runtime: Node.js (e.g., 18.x or later).
    - Handler: `index.handler` (or similar).
    - Memory/Timeout: Start with reasonable values (e.g., 256MB, 1-5 minutes) and adjust based on testing.
    - Environment Variables: Database connection details (host, user, password, database name). Use AWS Secrets Manager for production credentials.
    - IAM Role: `HourlyAggregatorLambdaRole`.
2.  **Logic (`index.js`):**
    - Include MySQL client library (e.g., `mysql2`).
    - Connect to MySQL.
    - Determine the last completed hour.
    - Query raw time-series data for that hour for all 6 silos.
    - Perform aggregation (AVG, MIN, MAX, SUM, COUNT).
    - Use `INSERT ... ON DUPLICATE KEY UPDATE` to store/update aggregates in `silo_hourly_aggregates`.
    - Implement proper error handling and logging.
3.  **Trigger:**
    - Configure an AWS CloudWatch Events Rule (Scheduler).
    - Schedule: e.g., `cron(5 * * * ? *)` (runs at 5 minutes past every hour).
    - Target: This Lambda function.

---

## Phase 6: AWS Lambda Development - `ReportGeneratorLambda`

1.  **Function Setup:**
    - Runtime: Node.js.
    - Handler: `index.handler`.
    - Memory/Timeout: Allocate more resources (e.g., 512MB - 1024MB, 5-15 minutes). Monitor and adjust.
    - Environment Variables: Database connection details, S3 bucket name.
    - IAM Role: `ReportGeneratorLambdaRole`.
    - Dependencies: `aws-sdk`, `mysql2`, `exceljs` (or similar Excel library). Package these with your Lambda deployment.
2.  **Logic (`index.js`):**
    - Receive `jobId` from the event payload.
    - Update `report_jobs` status to `PROCESSING` for `jobId`.
    - **Fetch Pre-Aggregated Data:** Query `silo_hourly_aggregates` for all data up to the last fully aggregated hour.
    - **Fetch "Hot" Data:** Query raw time-series data from the last aggregation point to "now".
    - **Aggregate "Hot" Data:** Perform hourly aggregation in memory.
    - **Combine Data:** Merge pre-aggregated and hot data.
    - **Generate Excel:**
      - Use `exceljs` to create an .xlsx file.
      - Create sheets and populate with aggregated data per silo.
    - **Store in S3:**
      - Upload the generated Excel buffer to the S3 reports bucket (e.g., `reports/{jobId}/silo_data_report.xlsx`).
    - **Generate Pre-signed S3 URL:**
      - Create a short-lived (e.g., 5-15 minutes) pre-signed GET URL for the S3 object.
    - **Update Job Status:** Update `report_jobs` for `jobId` to `COMPLETED` and store the pre-signed S3 URL.
    - **Error Handling:** If any step fails, update `report_jobs` to `FAILED` with an error message. Log detailed errors to CloudWatch.
3.  **Trigger:**
    - This Lambda will be invoked directly by the Node.js backend (asynchronous event invocation).

---

## Phase 7: Frontend Development (React)

1.  **UI Element:**
    - Add a "Generate Silo Report" button to the relevant page.
2.  **Initiate Report Generation:**
    - On button click, make a `POST` request to `/api/initiate-silo-report`.
    - On success, store the returned `jobId`.
    - Display a message to the user (e.g., "Report generation started. This may take a few minutes.").
    - Disable the button or provide visual feedback that processing is underway.
3.  **Poll for Status:**
    - Implement a polling mechanism (e.g., every 5-10 seconds) making a `GET` request to `/api/silo-report-status/{jobId}`.
    - **States:**
      - `PENDING`/`PROCESSING`: Continue polling, update UI message if needed.
      - `COMPLETED`:
        - Stop polling.
        - Enable a download link/button using the received `s3Url`.
        - Inform the user the report is ready.
      - `FAILED`:
        - Stop polling.
        - Display an error message to the user.
    - Consider a maximum number of polls or timeout for the polling mechanism.
4.  **Download Link:**
    - When the report is `COMPLETED`, the `s3Url` will be a pre-signed URL. Clicking a link pointing to this URL will initiate the download.

---

## Phase 8: Testing

1.  **Unit Tests:**
    - Test individual functions/modules within Lambdas (aggregation logic, Excel generation, DB interactions - can be mocked).
    - Test Node.js backend API endpoint logic (request handling, DB updates, Lambda invocation - can be mocked).
2.  **Integration Tests:**
    - Test Lambda interaction with MySQL (ensure connectivity, correct data retrieval/storage).
    - Test Lambda interaction with S3 (file upload, pre-signed URL generation).
    - Test Node.js backend invoking Lambda and updating `report_jobs` table.
3.  **End-to-End (E2E) Tests:**
    - Simulate user clicking the button in the frontend.
    - Verify the entire flow: request -> Node.js backend -> `ReportGeneratorLambda` -> S3 -> status update -> frontend polling -> download.
    - Test with varying amounts of data (e.g., a few hours, a few days, full 20 days).
    - Verify the content and format of the generated Excel file.
    - Test `HourlyAggregatorLambda` by manually triggering it or waiting for its schedule and verifying `silo_hourly_aggregates` table.
4.  **Load Testing (Optional but Recommended):**
    - Simulate multiple users requesting reports simultaneously to check system stability (especially the `ReportGeneratorLambda` concurrency and DB load).

---

## Phase 9: Deployment

1.  **Database Changes:**
    - Apply schema changes (new tables) to staging and production MySQL databases using migration scripts.
2.  **Lambda Functions:**
    - Package Lambda functions with their dependencies (e.g., using `npm install` and zipping, or via Serverless Framework/SAM).
    - Deploy to AWS Lambda (staging, then production).
    - Configure environment variables, triggers, IAM roles, VPC settings.
3.  **Node.js Backend:**
    - Deploy updated Node.js application with new API endpoints to your server(s).
4.  **Frontend:**
    - Deploy updated AngularJS frontend code.
5.  **Order of Deployment:**
    - Database changes.
    - IAM Roles & S3 Bucket.
    - Lambda functions.
    - Backend API changes.
    - Frontend changes.

---

## Phase 10: Monitoring & Maintenance

1.  **CloudWatch Monitoring:**
    - Monitor Lambda: Invocations, errors, duration, throttles, memory usage. Set up alarms for high error rates or long durations.
    - Monitor CloudWatch Logs for Lambdas and backend application for any issues.
2.  **Database Monitoring:**
    - Monitor query performance on `report_jobs`, `silo_hourly_aggregates`, and the raw data table.
    - Check for slow queries, especially during report generation or hourly aggregation.
3.  **S3 Bucket:**
    - Monitor storage growth. Ensure lifecycle policies are working.
4.  **Job Status Monitoring:**
    - Periodically check the `report_jobs` table for any jobs stuck in `PROCESSING` or a high number of `FAILED` jobs.
5.  **Cost Management:**
    - Monitor AWS costs related to Lambda, S3, and data transfer.
6.  **Regular Review:**
    - Periodically review the performance and resource consumption. As data grows, Lambda configurations or aggregation strategies might need adjustments.

---

This plan provides a comprehensive roadmap. Remember to adapt it based on your specific team practices and environment details. Good luck, David!
