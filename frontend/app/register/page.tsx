import { AuthAvailability } from "../../components/auth-availability";
import { PublicShell } from "../../components/public-shell";

export default function RegisterPage() {
  return <PublicShell><AuthAvailability mode="register" /></PublicShell>;
}
