"use client";

import { isSupabaseConfigured } from "@/lib/supabase";
import { CloudSchoolBenchmarkWorkspace } from "./CloudSchoolBenchmarkWorkspace";
import { SchoolBenchmarkWorkspace } from "./SchoolBenchmarkWorkspace";
import { CloudStudentBenchmarkWorkspace } from "./CloudStudentBenchmarkWorkspace";
import { StudentBenchmarkWorkspace } from "./StudentBenchmarkWorkspace";

export function SchoolBenchmarkRouter(){return isSupabaseConfigured?<CloudSchoolBenchmarkWorkspace/>:<SchoolBenchmarkWorkspace/>}
export function StudentBenchmarkRouter(){return isSupabaseConfigured?<CloudStudentBenchmarkWorkspace/>:<StudentBenchmarkWorkspace/>}
