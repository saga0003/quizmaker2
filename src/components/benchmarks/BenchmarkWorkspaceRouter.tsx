"use client";

import { isSupabaseConfigured } from "@/lib/supabase";
import { CloudSchoolBenchmarkWorkspace } from "./CloudSchoolBenchmarkWorkspace";
import { SchoolBenchmarkWorkspace } from "./SchoolBenchmarkWorkspace";
import { CloudStudentBenchmarkWorkspace } from "./CloudStudentBenchmarkWorkspace";
import { StudentBenchmarkWorkspace } from "./StudentBenchmarkWorkspace";
import { CloudBenchmarkGovernance } from "./CloudBenchmarkGovernance";
import { BenchmarkGovernance } from "./BenchmarkGovernance";

export function SchoolBenchmarkRouter(){return isSupabaseConfigured?<CloudSchoolBenchmarkWorkspace/>:<SchoolBenchmarkWorkspace/>}
export function StudentBenchmarkRouter(){return isSupabaseConfigured?<CloudStudentBenchmarkWorkspace/>:<StudentBenchmarkWorkspace/>}
export function AdminBenchmarkRouter(){return isSupabaseConfigured?<CloudBenchmarkGovernance/>:<BenchmarkGovernance/>}
