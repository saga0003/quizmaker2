import { redirect } from "next/navigation";

export default function SetupCheckRedirect() {
  redirect("/admin/readiness/");
}
