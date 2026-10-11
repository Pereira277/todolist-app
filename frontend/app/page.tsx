import Link from "next/link";

const buttonBase =
  "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent px-4 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2";

const features = [
  {
    title: "Start a list",
    description: "Add tasks in seconds. Nothing to configure.",
  },
  {
    title: "Share with people",
    description: "Invite others by email to view or edit your list.",
  },
  {
    title: "Finish together",
    description: "Everyone sees what's done and what's left.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-text-primary">
      <header className="mx-auto flex h-[72px] w-full max-w-[1040px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 text-text-primary no-underline"
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-primary shadow-1"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="text-on-primary"
            >
              <path d="M5 10.5l3.2 3.2L15 6.5" />
            </svg>
          </span>
          <span className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em]">
            Todo
          </span>
        </Link>
        {/* TODO(#4): point to the real sign-in route once Cognito auth lands */}
        <a
          href="#"
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-2 hover:text-primary-hover"
        >
          Sign in
        </a>
      </header>

      <main className="mx-auto flex w-full max-w-[1040px] flex-col items-stretch gap-8 px-4 pt-10 pb-16 sm:items-center sm:gap-12 sm:px-6 sm:pt-24">
        <div className="flex max-w-[640px] flex-col items-stretch gap-4 text-left sm:items-center sm:text-center">
          <h1 className="m-0 text-[40px] leading-[48px] font-semibold tracking-[-0.02em] text-text-primary">
            Plan less. Finish more.
          </h1>
          <p className="m-0 max-w-[480px] text-base leading-6 text-text-secondary sm:mx-auto">
            Make a to-do list, share it with the people you plan with, and
            check things off together. No setup, no clutter.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          {/* TODO(#4): point to the real sign-up route once Cognito auth lands */}
          <a
            href="#"
            className={`${buttonBase} w-full bg-primary text-on-primary hover:bg-primary-hover sm:w-auto`}
          >
            Create account
          </a>
          {/* TODO(#4): point to the real sign-in route once Cognito auth lands */}
          <a
            href="#"
            className={`${buttonBase} w-full border-border-strong bg-surface text-text-primary hover:border-text-secondary hover:bg-background sm:w-auto`}
          >
            Sign in
          </a>
        </div>

        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-6 text-left shadow-1"
            >
              <h2 className="m-0 text-base leading-6 font-semibold">
                {feature.title}
              </h2>
              <p className="m-0 text-sm leading-5 text-text-secondary">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
