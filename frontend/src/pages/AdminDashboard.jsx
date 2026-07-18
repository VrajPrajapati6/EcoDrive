import React from "react";
import { useAuth } from "../context/AuthContext";
import {
  Building2,
  Users,
  Settings,
  Sliders,
  BarChart3,
  ShieldCheck,
  Car,
  DollarSign,
} from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth();

  return <div></div>;
}
