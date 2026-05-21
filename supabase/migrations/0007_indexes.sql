-- Phase 1 migration: Performance indexes on FK columns + frequent filters.
-- Without these, queries like "all dispatch for vehicle X" do full table scans.

-- ─── Master data ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_vehicles_driver_id        ON vehicles(driver_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status           ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_employees_vehicle_id      ON employees(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_employees_position        ON employees(position);

-- ─── Operations: dispatch ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_dispatch_customer_id      ON dispatch(customer_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_driver_id        ON dispatch(driver_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_vehicle_id       ON dispatch(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_subcontractor_id ON dispatch(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_date             ON dispatch(date DESC);
CREATE INDEX IF NOT EXISTS idx_dispatch_status           ON dispatch(status);
CREATE INDEX IF NOT EXISTS idx_dispatch_round_status     ON dispatch(round_status);

CREATE INDEX IF NOT EXISTS idx_dispatch_legs_dispatch_id ON dispatch_legs(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_legs_customer_id ON dispatch_legs(customer_id);

-- ─── Maintenance ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle_id    ON maintenance(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_partner_id    ON maintenance(partner_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status        ON maintenance(status);

-- ─── Tires ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tires_vehicle_id          ON tires(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_tires_status              ON tires(status);
CREATE INDEX IF NOT EXISTS idx_tire_events_tire_id       ON tire_events(tire_id);
CREATE INDEX IF NOT EXISTS idx_tire_events_vehicle_id    ON tire_events(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_tire_scrap_sales_tire_id  ON tire_scrap_sales(tire_id);

-- ─── Fuel ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fuel_records_vehicle_id   ON fuel_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fuel_records_driver_id    ON fuel_records(driver_id);
CREATE INDEX IF NOT EXISTS idx_fuel_records_date         ON fuel_records(date DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_rounds_vehicle_id    ON fuel_rounds(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fuel_rounds_status        ON fuel_rounds(status);
CREATE INDEX IF NOT EXISTS idx_fuel_rounds_dispatch_id   ON fuel_rounds(dispatch_round_id);
CREATE INDEX IF NOT EXISTS idx_fuel_tx_vehicle_id        ON fuel_transactions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fuel_tx_trip_id           ON fuel_transactions(trip_id);
CREATE INDEX IF NOT EXISTS idx_fuel_tx_status            ON fuel_transactions(status);
CREATE INDEX IF NOT EXISTS idx_fuel_stock_date           ON fuel_stock(date DESC);

-- ─── Finance ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_expenses_vehicle_id       ON expenses(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_expenses_driver_id        ON expenses(driver_id);
CREATE INDEX IF NOT EXISTS idx_expenses_partner_id       ON expenses(partner_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date             ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expense_headers_vehicle   ON expense_headers(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_expense_headers_partner   ON expense_headers(partner_id);
CREATE INDEX IF NOT EXISTS idx_expense_headers_date      ON expense_headers(date DESC);
CREATE INDEX IF NOT EXISTS idx_expense_lines_header_id   ON expense_lines(header_id);
CREATE INDEX IF NOT EXISTS idx_fixed_costs_vehicle_id    ON fixed_costs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_stock_receipts_item_id    ON stock_receipts(stock_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_receipts_partner_id ON stock_receipts(partner_id);

-- ─── Subcontractors ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sub_drivers_sub_id        ON sub_drivers(sub_id);
CREATE INDEX IF NOT EXISTS idx_sub_jobs_sub_id           ON sub_jobs(sub_id);
CREATE INDEX IF NOT EXISTS idx_sub_jobs_driver_id        ON sub_jobs(driver_id);
CREATE INDEX IF NOT EXISTS idx_sub_jobs_status           ON sub_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sub_jobs_date             ON sub_jobs(date DESC);

-- ─── Admin / audit ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_activity_logs_at          ON activity_logs(at DESC);
CREATE INDEX IF NOT EXISTS idx_task_completions_vehicle  ON task_completions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_edit_approvals_vehicle    ON edit_approvals(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_edit_approvals_status     ON edit_approvals(status);
