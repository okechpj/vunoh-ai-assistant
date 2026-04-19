-- Schema for Vunoh AI Task Management
-- Requires pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_code text UNIQUE NOT NULL,
  intent text NOT NULL,
  created_by uuid,
  risk_score integer NOT NULL,
  risk_level text NOT NULL,
  status text DEFAULT 'Pending',
  assigned_team text NOT NULL,
  assigned_unit text,
  created_at timestamptz DEFAULT now()
);

-- entities
CREATE TABLE IF NOT EXISTS entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  value text,
  created_at timestamptz DEFAULT now()
);

-- task steps
CREATE TABLE IF NOT EXISTS task_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  description text NOT NULL
);

-- messages
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('whatsapp','email','sms')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- status history
CREATE TABLE IF NOT EXISTS status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_at timestamptz DEFAULT now()
);

-- Sample data: 5 realistic tasks
-- Task 1: send_money
INSERT INTO tasks (task_code,intent,risk_score,risk_level,assigned_team,assigned_unit)
VALUES ('TASK-1001','send_money',50,'low','Payments','Remittance');

-- entities for task 1
INSERT INTO entities (task_id,entity_type,value)
SELECT t.id,'amount','50' FROM tasks t WHERE t.task_code='TASK-1001';
INSERT INTO entities (task_id,entity_type,value)
SELECT t.id,'recipient','Alice' FROM tasks t WHERE t.task_code='TASK-1001';

-- steps for task 1
INSERT INTO task_steps (task_id,step_order,description)
SELECT t.id,1,'Validate recipient details' FROM tasks t WHERE t.task_code='TASK-1001';
INSERT INTO task_steps (task_id,step_order,description)
SELECT t.id,2,'Reserve funds and create transfer' FROM tasks t WHERE t.task_code='TASK-1001';
INSERT INTO task_steps (task_id,step_order,description)
SELECT t.id,3,'Notify recipient' FROM tasks t WHERE t.task_code='TASK-1001';

-- messages for task 1
INSERT INTO messages (task_id,type,content)
SELECT t.id,'whatsapp','🔔 Task TASK-1001 received. We will process your $50 transfer.' FROM tasks t WHERE t.task_code='TASK-1001';
INSERT INTO messages (task_id,type,content)
SELECT t.id,'email','Task TASK-1001\n\nWe received your transfer request for $50 to Alice.' FROM tasks t WHERE t.task_code='TASK-1001';
INSERT INTO messages (task_id,type,content)
SELECT t.id,'sms','Task TASK-1001: Transfer of $50 to Alice received.' FROM tasks t WHERE t.task_code='TASK-1001';

INSERT INTO status_history (task_id,old_status,new_status)
SELECT t.id,NULL,'Pending' FROM tasks t WHERE t.task_code='TASK-1001';

-- Task 2: hire_service
INSERT INTO tasks (task_code,intent,risk_score,risk_level,assigned_team,assigned_unit)
VALUES ('TASK-2002','hire_service',30,'medium','Ops','Service Desk');

INSERT INTO entities (task_id,entity_type,value)
SELECT t.id,'service_type','cleaning' FROM tasks t WHERE t.task_code='TASK-2002';
INSERT INTO entities (task_id,entity_type,value)
SELECT t.id,'location','123 Main St' FROM tasks t WHERE t.task_code='TASK-2002';

INSERT INTO task_steps (task_id,step_order,description)
SELECT t.id,1,'Confirm schedule' FROM tasks t WHERE t.task_code='TASK-2002';
INSERT INTO task_steps (task_id,step_order,description)
SELECT t.id,2,'Assign cleaner' FROM tasks t WHERE t.task_code='TASK-2002';
INSERT INTO task_steps (task_id,step_order,description)
SELECT t.id,3,'Complete service and collect feedback' FROM tasks t WHERE t.task_code='TASK-2002';

INSERT INTO messages (task_id,type,content)
SELECT t.id,'whatsapp','Your service request TASK-2002 is queued.' FROM tasks t WHERE t.task_code='TASK-2002';
INSERT INTO messages (task_id,type,content)
SELECT t.id,'email','TASK-2002: Cleaning request received.' FROM tasks t WHERE t.task_code='TASK-2002';
INSERT INTO messages (task_id,type,content)
SELECT t.id,'sms','TASK-2002 received.' FROM tasks t WHERE t.task_code='TASK-2002';

INSERT INTO status_history (task_id,old_status,new_status)
SELECT t.id,NULL,'Pending' FROM tasks t WHERE t.task_code='TASK-2002';

-- Task 3: verify_document
INSERT INTO tasks (task_code,intent,risk_score,risk_level,assigned_team,assigned_unit)
VALUES ('TASK-3003','verify_document',65,'high','Compliance','KYC');

INSERT INTO entities (task_id,entity_type,value)
SELECT t.id,'document_type','passport' FROM tasks t WHERE t.task_code='TASK-3003';

INSERT INTO task_steps (task_id,step_order,description)
SELECT t.id,1,'Scan and validate document' FROM tasks t WHERE t.task_code='TASK-3003';
INSERT INTO task_steps (task_id,step_order,description)
SELECT t.id,2,'Cross-check against watchlists' FROM tasks t WHERE t.task_code='TASK-3003';
INSERT INTO task_steps (task_id,step_order,description)
SELECT t.id,3,'Approve or escalate' FROM tasks t WHERE t.task_code='TASK-3003';

INSERT INTO messages (task_id,type,content)
SELECT t.id,'whatsapp','We received TASK-3003 to verify your passport.' FROM tasks t WHERE t.task_code='TASK-3003';
INSERT INTO messages (task_id,type,content)
SELECT t.id,'email','TASK-3003: Passport verification request.' FROM tasks t WHERE t.task_code='TASK-3003';
INSERT INTO messages (task_id,type,content)
SELECT t.id,'sms','TASK-3003 received for passport verification.' FROM tasks t WHERE t.task_code='TASK-3003';

INSERT INTO status_history (task_id,old_status,new_status)
SELECT t.id,NULL,'Pending' FROM tasks t WHERE t.task_code='TASK-3003';

-- Task 4: get_airport_transfer
INSERT INTO tasks (task_code,intent,risk_score,risk_level,assigned_team,assigned_unit)
VALUES ('TASK-4004','get_airport_transfer',22,'low','Logistics','Transfers');

INSERT INTO entities (task_id,entity_type,value)
SELECT t.id,'location','JFK Airport' FROM tasks t WHERE t.task_code='TASK-4004';
INSERT INTO entities (task_id,entity_type,value)
SELECT t.id,'service_type','airport_transfer' FROM tasks t WHERE t.task_code='TASK-4004';

INSERT INTO task_steps (task_id,step_order,description)
SELECT t.id,1,'Confirm flight details' FROM tasks t WHERE t.task_code='TASK-4004';
INSERT INTO task_steps (task_id,step_order,description)
SELECT t.id,2,'Assign driver' FROM tasks t WHERE t.task_code='TASK-4004';
INSERT INTO task_steps (task_id,step_order,description)
SELECT t.id,3,'Send pickup confirmation' FROM tasks t WHERE t.task_code='TASK-4004';

INSERT INTO messages (task_id,type,content)
SELECT t.id,'whatsapp','TASK-4004 scheduled: airport transfer.' FROM tasks t WHERE t.task_code='TASK-4004';
INSERT INTO messages (task_id,type,content)
SELECT t.id,'email','TASK-4004: Airport transfer request.' FROM tasks t WHERE t.task_code='TASK-4004';
INSERT INTO messages (task_id,type,content)
SELECT t.id,'sms','TASK-4004 airport transfer scheduled.' FROM tasks t WHERE t.task_code='TASK-4004';

INSERT INTO status_history (task_id,old_status,new_status)
SELECT t.id,NULL,'Pending' FROM tasks t WHERE t.task_code='TASK-4004';

-- Task 5: check_status
INSERT INTO tasks (task_code,intent,risk_score,risk_level,assigned_team,assigned_unit)
VALUES ('TASK-5005','check_status',5,'low','Support','Status Desk');

INSERT INTO messages (task_id,type,content)
SELECT t.id,'whatsapp','You requested status for TASK-1001' FROM tasks t WHERE t.task_code='TASK-5005';
INSERT INTO messages (task_id,type,content)
SELECT t.id,'email','TASK-5005: status query received.' FROM tasks t WHERE t.task_code='TASK-5005';
INSERT INTO messages (task_id,type,content)
SELECT t.id,'sms','Status request received.' FROM tasks t WHERE t.task_code='TASK-5005';

INSERT INTO status_history (task_id,old_status,new_status)
SELECT t.id,NULL,'Pending' FROM tasks t WHERE t.task_code='TASK-5005';
