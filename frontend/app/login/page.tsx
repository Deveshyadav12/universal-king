import { AuthAvailability } from "../../components/auth-availability";
import { PublicShell } from "../../components/public-shell";

export default function LoginPage() {
  return <PublicShell><AuthAvailability mode="login" /></PublicShell>;
}
