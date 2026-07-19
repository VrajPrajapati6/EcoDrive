import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getOrganizationRidesReport,
  getOrganizationEmployees,
  toggleEmployeeStatus,
  getOrganizationVehicles,
  toggleVehicleApproval,
  updateOrganizationSettings,
  adminAddEmployee,
  adminAddVehicle,
} from "../services/api";

import { supabase } from "../services/supabaseClient";

export default function AdminDashboard() {
  const { user } = useAuth();

  // Navigation: 'reports' | 'employees' | 'vehicles' | 'settings'
  const [activeTab, setActiveTab] = useState("employees");

  // Table data states
  const [reports, setReports] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  // Loading states
  const [loadingReports, setLoadingReports] = useState(true);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingVehicles, setLoadingVehicles] = useState(true);

  // Form states for settings
  const [settingsForm, setSettingsForm] = useState({
    name: "",
    industry: "",
    registeredAddress: "",
    adminContact: "",
    fuelCost: 96.5,
    costPerKm: 8.0,
    travelCostOperational: 2.5,
  });

  // Modal control states
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);

  // New Employee fields
  const [newEmployee, setNewEmployee] = useState({
    email: "",
    password: "",
    fullName: "",
    employeeId: "",
    phone: "",
  });

  // New Vehicle fields
  const [newVehicle, setNewVehicle] = useState({
    makeModel: "",
    licensePlate: "",
    capacity: 4,
    userEmail: "",
  });

  // Toast / messages
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Initial load
  useEffect(() => {
    loadReports();
    loadEmployees();
    loadVehicles();
  }, []);

  // Initialize Settings Form when user info resolves
  useEffect(() => {
    if (user?.organization) {
      setSettingsForm({
        name: user.organization.name || "",
        industry: user.organization.industry || "Software",
        registeredAddress: user.organization.registeredAddress || "Gandhinagar",
        adminContact: user.organization.adminContact || "admin@techcorp.com",
        fuelCost: user.organization.fuelCost || 96.5,
        costPerKm: user.organization.costPerKm || 8.0,
        travelCostOperational: user.organization.travelCostOperational || 2.5,
      });
    }
  }, [user]);

  // Realtime Supabase changes
  useEffect(() => {
    const channel = supabase
      .channel("admin-dashboard-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rides" },
        () => {
          loadReports();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => {
          loadReports();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        () => {
          loadEmployees();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehicles" },
        () => {
          loadVehicles();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const showNotification = (msg, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(""), 4500);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(""), 4500);
    }
  };

  const loadReports = async () => {
    setLoadingReports(true);
    try {
      const data = await getOrganizationRidesReport();
      setReports(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReports(false);
    }
  };

  const loadEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const data = await getOrganizationEmployees();
      setEmployees(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const loadVehicles = async () => {
    setLoadingVehicles(true);
    try {
      const data = await getOrganizationVehicles();
      setVehicles(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingVehicles(false);
    }
  };

  const handleToggleEmployee = async (employeeId, currentStatus) => {
    const nextStatus = !currentStatus;
    if (
      !window.confirm(
        `Are you sure you want to ${nextStatus ? "activate" : "deactivate"} this employee?`,
      )
    )
      return;
    try {
      const res = await toggleEmployeeStatus(employeeId, nextStatus);
      showNotification(res.message);
      loadEmployees();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handleToggleVehicle = async (vehicleId, currentStatus) => {
    const nextStatus = !currentStatus;
    if (
      !window.confirm(
        `Are you sure you want to make this vehicle ${nextStatus ? "Approved" : "Inactive"}?`,
      )
    )
      return;
    try {
      const res = await toggleVehicleApproval(vehicleId, nextStatus);
      showNotification(res.message);
      loadVehicles();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handleAddEmployeeSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await adminAddEmployee(newEmployee);
      showNotification(res.message);
      setShowEmployeeModal(false);
      setNewEmployee({
        email: "",
        password: "",
        fullName: "",
        employeeId: "",
        phone: "",
      });
      loadEmployees();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handleAddVehicleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await adminAddVehicle(newVehicle);
      showNotification(res.message);
      setShowVehicleModal(false);
      setNewVehicle({
        makeModel: "",
        licensePlate: "",
        capacity: 4,
        userEmail: "",
      });
      loadVehicles();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await updateOrganizationSettings(settingsForm);
      showNotification(res.message);
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  // Helper Stats
  const totalRides = reports.length;

  const totalEmployeesCount = employees.length + 1; // including Admin themselves
  const totalVehiclesCount = vehicles.length;

  // Calculate CO2 Saved: completed rides * booked seats * distance (since each passenger share offsets single driving)
  // Let's assume 0.2kg CO2 saved per km per passenger
  const co2OffsetKg = reports
    .filter((r) => r.status === "Completed")
    .reduce((acc, ride) => acc + parseFloat(ride.total_booked) * 15 * 0.2, 0); // fallback distance estimation 15km if not saved on ride

  return (
    <div className="odoo-container">
      {/* Odoo Hero Banner */}
      <div
        className="odoo-hero"
        style={{
          background: "var(--bg-page)",
          color: "var(--text-main)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "1.5rem",
          }}
        >
          <div>
            <span
              className="odoo-badge"
              style={{
                background: "var(--bg-page)",
                color: "var(--text-main)",
                borderColor: "var(--text-main)",
                marginBottom: "0.75rem",
                display: "inline-block",
                fontWeight: "bold",
              }}
            >
              COMPANY GOVERNANCE PORTAL
            </span>
            <h1 style={{ color: "var(--text-main)" }}>{user?.organization?.name} Carpooling</h1>
            <p style={{ color: "var(--text-main)" }}>
              Define enterprise configuration, approve vehicle registries,
              verify ride logs, and manage employee accounts.
            </p>
          </div>
          <div
            style={{
              background: "var(--bg-page)",
              color: "var(--text-main)",
              padding: "1.25rem",
              borderRadius: "10px",
              border: "2px solid var(--text-main)",
              minWidth: "240px",
            }}
          >
            <div style={{ fontSize: "0.8rem", opacity: 0.85 }}>
              ADMINISTRATOR
            </div>
            <div
              style={{
                fontSize: "1.2rem",
                fontWeight: 700,
                margin: "0.25rem 0",
              }}
            >
              {user?.fullName}
            </div>
            <div
              style={{
                fontSize: "0.8rem",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <span>Full Governance Access</span>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Stats Row */}
      <div className="grid-3" style={{ marginBottom: "2rem" }}>
        <div className="odoo-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                }}
              >
                TOTAL EMPLOYEES
              </div>
              <div
                style={{
                  fontSize: "1.75rem",
                  fontWeight: 700,
                  color: "var(--odoo-violet)",
                }}
              >
                {totalEmployeesCount}
              </div>
            </div>
          </div>
        </div>
        <div className="odoo-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                }}
              >
                REGISTERED VEHICLES
              </div>
              <div
                style={{
                  fontSize: "1.75rem",
                  fontWeight: 700,
                  color: "var(--odoo-teal)",
                }}
              >
                {totalVehiclesCount}
              </div>
            </div>
          </div>
        </div>
        <div className="odoo-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                }}
              >
                RIDES THIS MONTH
              </div>
              <div
                style={{
                  fontSize: "1.75rem",
                  fontWeight: 700,
                  color: "#2b8a3e",
                }}
              >
                {totalRides}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Unique CO2 Green Dashboard Panel */}
      <div
        style={{
          background: "linear-gradient(135deg, #ebfbee 0%, #d3f9d8 100%)",
          border: "1px solid #b2f2bb",
          borderRadius: "10px",
          padding: "1.25rem 1.75rem",
          marginBottom: "2.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              background: "#2b8a3e",
              color: "white",
              padding: "10px",
              borderRadius: "50%",
            }}
          >
            <></>
          </div>
          <div>
            <h4
              style={{
                color: "#2b8a3e",
                margin: 0,
                fontSize: "1.1rem",
                fontWeight: 700,
              }}
            >
              EcoDrive CO2 Offset Metrics
            </h4>
            <p style={{ color: "#5c940d", margin: 0, fontSize: "0.85rem" }}>
              Calculated carbon emissions saved by your team sharing daily
              corporate rides.
            </p>
          </div>
        </div>
        <div>
          <span
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "#2b8a3e",
              display: "block",
              textAlign: "right",
            }}
          >
            ESTIMATED CO2 OFFSET
          </span>
          <strong style={{ fontSize: "2rem", color: "#2b8a3e" }}>
            {co2OffsetKg.toFixed(1)}{" "}
            <span style={{ fontSize: "1rem" }}>kg</span>
          </strong>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div
          style={{
            background: "#d4edda",
            color: "#155724",
            padding: "1rem",
            borderRadius: "6px",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div
          style={{
            background: "#f8d7da",
            color: "#721c24",
            padding: "1rem",
            borderRadius: "6px",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <></> {errorMsg}
        </div>
      )}

      {/* Tab Controls */}
      <div className="odoo-tabs" style={{ marginBottom: "2rem" }}>
        <button
          className={`odoo-tab ${activeTab === "employees" ? "active" : ""}`}
          onClick={() => setActiveTab("employees")}
        >
          Employees
        </button>
        <button
          className={`odoo-tab ${activeTab === "vehicles" ? "active" : ""}`}
          onClick={() => setActiveTab("vehicles")}
        >
          Vehicles
        </button>
        <button
          className={`odoo-tab ${activeTab === "reports" ? "active" : ""}`}
          onClick={() => setActiveTab("reports")}
        >
          <></> Ride Reports
        </button>
        <button
          className={`odoo-tab ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          Settings
        </button>
      </div>

      {/* Tab Panels */}
      <div className="odoo-card" style={{ padding: "2rem" }}>
        {/* TAB 1: Employees */}
        {activeTab === "employees" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.5rem",
                flexWrap: "wrap",
                gap: "1rem",
              }}
            >
              <div>
                <h3 style={{ color: "var(--odoo-violet)", margin: 0 }}>
                  Registered Employees
                </h3>
                <p
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.85rem",
                    margin: 0,
                  }}
                >
                  Manage employee system access and platform accounts.
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  className="btn btn-teal"
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                  onClick={() => setShowEmployeeModal(true)}
                >
                  <></> Add Employee
                </button>
                <button className="btn btn-outline" onClick={loadEmployees}>
                  <></>
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              {loadingEmployees ? (
                <p>Loading employees...</p>
              ) : employees.length === 0 ? (
                <p style={{ color: "var(--text-muted)" }}>
                  No employees registered yet.
                </p>
              ) : (
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.9rem",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: "2px solid var(--border-color)",
                        textAlign: "left",
                        color: "var(--text-muted)",
                      }}
                    >
                      <th style={{ padding: "0.75rem 0.5rem" }}>Name</th>
                      <th style={{ padding: "0.75rem 0.5rem" }}>Email</th>
                      <th style={{ padding: "0.75rem 0.5rem" }}>Employee ID</th>
                      <th style={{ padding: "0.75rem 0.5rem" }}>Phone</th>
                      <th style={{ padding: "0.75rem 0.5rem" }}>
                        Platform Access
                      </th>
                      <th
                        style={{
                          padding: "0.75rem 0.5rem",
                          textAlign: "right",
                        }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr
                        key={emp.id}
                        style={{
                          borderBottom: "1px solid var(--border-color)",
                        }}
                      >
                        <td style={{ padding: "1rem 0.5rem", fontWeight: 600 }}>
                          {emp.fullName}
                        </td>
                        <td style={{ padding: "1rem 0.5rem" }}>{emp.email}</td>
                        <td style={{ padding: "1rem 0.5rem" }}>
                          {emp.employeeId || "N/A"}
                        </td>
                        <td style={{ padding: "1rem 0.5rem" }}>
                          {emp.phone || "N/A"}
                        </td>
                        <td style={{ padding: "1rem 0.5rem" }}>
                          <span
                            className={`odoo-badge ${emp.isActive ? "odoo-badge-teal" : ""}`}
                            style={{
                              background: !emp.isActive ? "#fff3cd" : "",
                              color: !emp.isActive ? "#856404" : "",
                            }}
                          >
                            {emp.isActive ? "Granted" : "Revoked"}
                          </span>
                        </td>
                        <td
                          style={{ padding: "1rem 0.5rem", textAlign: "right" }}
                        >
                          <button
                            className={`btn ${emp.isActive ? "btn-outline" : "btn-teal"}`}
                            style={{
                              fontSize: "0.8rem",
                              padding: "0.4rem 0.8rem",
                              borderColor: emp.isActive ? "#dc3545" : "",
                              color: emp.isActive ? "#dc3545" : "",
                            }}
                            onClick={() =>
                              handleToggleEmployee(emp.id, emp.isActive)
                            }
                          >
                            {emp.isActive ? "Revoke Access" : "Grant Access"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Vehicles */}
        {activeTab === "vehicles" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.5rem",
                flexWrap: "wrap",
                gap: "1rem",
              }}
            >
              <div>
                <h3 style={{ color: "var(--odoo-violet)", margin: 0 }}>
                  Registered Vehicles
                </h3>
                <p
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.85rem",
                    margin: 0,
                  }}
                >
                  Review and approve employee cars registered for corporate
                  carpooling.
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  className="btn btn-teal"
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                  onClick={() => setShowVehicleModal(true)}
                >
                  Add Vehicle
                </button>
                <button className="btn btn-outline" onClick={loadVehicles}>
                  <></>
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              {loadingVehicles ? (
                <p>Loading vehicles...</p>
              ) : vehicles.length === 0 ? (
                <p style={{ color: "var(--text-muted)" }}>
                  No vehicles registered yet.
                </p>
              ) : (
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.9rem",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: "2px solid var(--border-color)",
                        textAlign: "left",
                        color: "var(--text-muted)",
                      }}
                    >
                      <th style={{ padding: "0.75rem 0.5rem" }}>
                        Registration Number
                      </th>
                      <th style={{ padding: "0.75rem 0.5rem" }}>Model</th>
                      <th style={{ padding: "0.75rem 0.5rem" }}>
                        Seating Capacity
                      </th>
                      <th style={{ padding: "0.75rem 0.5rem" }}>Driver</th>
                      <th style={{ padding: "0.75rem 0.5rem" }}>Status</th>
                      <th
                        style={{
                          padding: "0.75rem 0.5rem",
                          textAlign: "right",
                        }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.map((veh) => (
                      <tr
                        key={veh.id}
                        style={{
                          borderBottom: "1px solid var(--border-color)",
                        }}
                      >
                        <td
                          style={{
                            padding: "1rem 0.5rem",
                            fontWeight: 600,
                            color: "var(--odoo-teal)",
                          }}
                        >
                          {veh.licensePlate}
                        </td>
                        <td style={{ padding: "1rem 0.5rem" }}>
                          {veh.makeModel}
                        </td>
                        <td style={{ padding: "1rem 0.5rem" }}>
                          {veh.capacity} seats
                        </td>
                        <td style={{ padding: "1rem 0.5rem" }}>
                          <div>{veh.driverName}</div>
                          <div
                            style={{
                              fontSize: "0.8rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            {veh.driverEmail}
                          </div>
                        </td>
                        <td style={{ padding: "1rem 0.5rem" }}>
                          <span
                            className={`odoo-badge ${veh.isApproved ? "odoo-badge-teal" : ""}`}
                            style={{
                              background: !veh.isApproved ? "#f8d7da" : "",
                              color: !veh.isApproved ? "#721c24" : "",
                            }}
                          >
                            {veh.isApproved ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td
                          style={{ padding: "1rem 0.5rem", textAlign: "right" }}
                        >
                          <button
                            className={`btn ${veh.isApproved ? "btn-outline" : "btn-teal"}`}
                            style={{
                              fontSize: "0.8rem",
                              padding: "0.4rem 0.8rem",
                              borderColor: veh.isApproved ? "#dc3545" : "",
                              color: veh.isApproved ? "#dc3545" : "",
                            }}
                            onClick={() =>
                              handleToggleVehicle(veh.id, veh.isApproved)
                            }
                          >
                            {veh.isApproved ? "Deactivate" : "Approve"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: Ride Reports */}
        {activeTab === "reports" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.5rem",
              }}
            >
              <div>
                <h3 style={{ color: "var(--odoo-violet)", margin: 0 }}>
                  Organization Ride Reports
                </h3>
                <p
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.85rem",
                    margin: 0,
                  }}
                >
                  Audit log of completed, active, and deleted employee rides.
                </p>
              </div>
              <button className="btn btn-outline" onClick={loadReports}>
                <></>
              </button>
            </div>

            <div style={{ overflowX: "auto" }}>
              {loadingReports ? (
                <p>Loading reports...</p>
              ) : reports.length === 0 ? (
                <p style={{ color: "var(--text-muted)" }}>
                  No rides have been offered in your organization yet.
                </p>
              ) : (
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.9rem",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: "2px solid var(--border-color)",
                        textAlign: "left",
                        color: "var(--text-muted)",
                      }}
                    >
                      <th style={{ padding: "0.75rem 0.5rem" }}>Route</th>
                      <th style={{ padding: "0.75rem 0.5rem" }}>Schedule</th>
                      <th style={{ padding: "0.75rem 0.5rem" }}>Driver</th>
                      <th style={{ padding: "0.75rem 0.5rem" }}>Vehicle</th>
                      <th style={{ padding: "0.75rem 0.5rem" }}>
                        Seats (Booked/Total)
                      </th>
                      <th style={{ padding: "0.75rem 0.5rem" }}>Fare</th>
                      <th style={{ padding: "0.75rem 0.5rem" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((ride) => {
                      const totalSeats =
                        ride.available_seats + ride.total_booked;
                      const isCancelled = ride.status === "Cancelled";
                      return (
                        <tr
                          key={ride.id}
                          style={{
                            borderBottom: "1px solid var(--border-color)",
                          }}
                        >
                          <td
                            style={{ padding: "1rem 0.5rem", fontWeight: 600 }}
                          >
                            {ride.pickup_location} → {ride.destination}
                          </td>
                          <td
                            style={{
                              padding: "1rem 0.5rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            <div>
                              {new Date(
                                ride.departure_date,
                              ).toLocaleDateString()}
                            </div>
                            <div>{ride.departure_time}</div>
                          </td>
                          <td style={{ padding: "1rem 0.5rem" }}>
                            <div>{ride.driver_name}</div>
                            <div
                              style={{
                                fontSize: "0.8rem",
                                color: "var(--text-muted)",
                              }}
                            >
                              {ride.driver_email}
                            </div>
                          </td>
                          <td style={{ padding: "1rem 0.5rem" }}>
                            <div>{ride.vehicle_make}</div>
                            <div
                              style={{
                                fontSize: "0.8rem",
                                color: "var(--text-muted)",
                              }}
                            >
                              {ride.license_plate}
                            </div>
                          </td>
                          <td
                            style={{
                              padding: "1rem 0.5rem",
                              textAlign: "center",
                            }}
                          >
                            {ride.total_booked} / {totalSeats}
                          </td>
                          <td style={{ padding: "1rem 0.5rem" }}>
                            ${ride.fare_per_seat}
                          </td>
                          <td style={{ padding: "1rem 0.5rem" }}>
                            <span
                              className={`odoo-badge ${ride.status === "Completed" ? "odoo-badge-teal" : ""}`}
                              style={{
                                background: isCancelled ? "#f8d7da" : "",
                                color: isCancelled ? "#721c24" : "",
                              }}
                            >
                              {ride.status}{" "}
                              {ride.cancellation_reason &&
                                `(Reason: ${ride.cancellation_reason})`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: Settings */}
        {activeTab === "settings" && (
          <div>
            <h3 style={{ color: "var(--odoo-violet)", marginBottom: "1.5rem" }}>
              Company Carpooling Settings
            </h3>
            <form onSubmit={handleSaveSettings}>
              <h4
                style={{
                  color: "var(--odoo-teal)",
                  borderBottom: "1px solid var(--border-color)",
                  paddingBottom: "0.5rem",
                  marginBottom: "1rem",
                }}
              >
                Company Details
              </h4>
              <div className="grid-2" style={{ marginBottom: "1.5rem" }}>
                <div className="form-group">
                  <label className="form-label">Company Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={settingsForm.name}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Industry</label>
                  <input
                    type="text"
                    className="form-control"
                    value={settingsForm.industry}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        industry: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Registered Address</label>
                  <input
                    type="text"
                    className="form-control"
                    value={settingsForm.registeredAddress}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        registeredAddress: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Admin Contact Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={settingsForm.adminContact}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        adminContact: e.target.value,
                      })
                    }
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                className="btn btn-teal"
                style={{ padding: "0.6rem 1.5rem" }}
              >
                Save Settings
              </button>
            </form>
          </div>
        )}
      </div>

      {/* MODAL 1: Add Employee */}
      {showEmployeeModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            className="odoo-card"
            style={{
              maxWidth: "500px",
              width: "100%",
              padding: "2rem",
              zIndex: 1001,
            }}
          >
            <h3
              style={{
                color: "var(--odoo-violet)",
                marginTop: 0,
                marginBottom: "1.25rem",
              }}
            >
              Add New Employee
            </h3>
            <form onSubmit={handleAddEmployeeSubmit}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={newEmployee.fullName}
                  onChange={(e) =>
                    setNewEmployee({ ...newEmployee, fullName: e.target.value })
                  }
                  placeholder="Enter employee full name"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  value={newEmployee.email}
                  onChange={(e) =>
                    setNewEmployee({ ...newEmployee, email: e.target.value })
                  }
                  placeholder="e.g. employee@techcorp.com"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={newEmployee.password}
                  onChange={(e) =>
                    setNewEmployee({ ...newEmployee, password: e.target.value })
                  }
                  placeholder="Initial login password"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Employee ID (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  value={newEmployee.employeeId}
                  onChange={(e) =>
                    setNewEmployee({
                      ...newEmployee,
                      employeeId: e.target.value,
                    })
                  }
                  placeholder="e.g. EMP-1042"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  value={newEmployee.phone}
                  onChange={(e) =>
                    setNewEmployee({ ...newEmployee, phone: e.target.value })
                  }
                  placeholder="e.g. +91 9999999999"
                />
              </div>
              <div
                style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}
              >
                <button type="submit" className="btn btn-teal">
                  Create Profile
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowEmployeeModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Vehicle */}
      {showVehicleModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            className="odoo-card"
            style={{
              maxWidth: "500px",
              width: "100%",
              padding: "2rem",
              zIndex: 1001,
            }}
          >
            <h3
              style={{
                color: "var(--odoo-violet)",
                marginTop: 0,
                marginBottom: "1.25rem",
              }}
            >
              Register Employee Vehicle
            </h3>
            <form onSubmit={handleAddVehicleSubmit}>
              <div className="form-group">
                <label className="form-label">Employee Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  value={newVehicle.userEmail}
                  onChange={(e) =>
                    setNewVehicle({ ...newVehicle, userEmail: e.target.value })
                  }
                  placeholder="Associated employee login email"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Vehicle Make & Model</label>
                <input
                  type="text"
                  className="form-control"
                  value={newVehicle.makeModel}
                  onChange={(e) =>
                    setNewVehicle({ ...newVehicle, makeModel: e.target.value })
                  }
                  placeholder="e.g. Swift Dzire, Innova Crysta"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">License Plate Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={newVehicle.licensePlate}
                  onChange={(e) =>
                    setNewVehicle({
                      ...newVehicle,
                      licensePlate: e.target.value,
                    })
                  }
                  placeholder="e.g. GJ01AB1234"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Seating Capacity</label>
                <input
                  type="number"
                  min="2"
                  max="12"
                  className="form-control"
                  value={newVehicle.capacity}
                  onChange={(e) =>
                    setNewVehicle({
                      ...newVehicle,
                      capacity: parseInt(e.target.value) || 4,
                    })
                  }
                  required
                />
              </div>
              <div
                style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}
              >
                <button type="submit" className="btn btn-teal">
                  Register Vehicle
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowVehicleModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
