import { SignUp } from "@clerk/nextjs";

// Invite-only for MVP: Clerk restricts sign-up to invited users. No public
// self-serve onboarding is built yet (see spec: out of scope).
export default function SignUpPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg p-6">
      <SignUp />
    </div>
  );
}
