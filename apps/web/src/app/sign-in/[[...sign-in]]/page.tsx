import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg p-6">
      <div className="flex flex-col items-center gap-8">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          <span className="font-display text-lg font-medium tracking-tight text-primary">
            Rotation
          </span>
        </div>
        <SignIn />
      </div>
    </div>
  );
}
