type SearchInputProps = {
  examples: readonly string[];
  isLoading: boolean;
  value: string;
  onChange: (value: string) => void;
  onExampleClick: (value: string) => void;
  onGenerate: () => void;
  onRandom: () => void;
};

export function SearchInput({
  examples,
  isLoading,
  value,
  onChange,
  onExampleClick,
  onGenerate,
  onRandom
}: SearchInputProps) {
  return (
    <section className="flex w-full max-w-2xl flex-col items-center gap-5">
      <form
        className="flex w-full flex-col items-center gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          onGenerate();
        }}
      >
        <label className="sr-only" htmlFor="core-input">
          Core keyword
        </label>
        <input
          id="core-input"
          autoComplete="off"
          className="w-full rounded-full border border-white/15 bg-white/[0.04] px-6 py-4 text-center text-base text-white outline-none transition focus:border-white/40 focus:bg-white/[0.07] sm:text-lg"
          disabled={isLoading}
          placeholder="type a core..."
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
        <div className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            className="w-full rounded-full border border-white/15 bg-white px-5 py-2 text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-white/10 disabled:text-white/35 sm:w-auto"
            disabled={!value.trim() || isLoading}
            type="submit"
          >
            {isLoading ? "Generating..." : "Generate"}
          </button>
          <button
            className="w-full rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-white transition hover:border-white/35 hover:bg-white/8 sm:w-auto"
            disabled={isLoading}
            type="button"
            onClick={onRandom}
          >
            Random Core
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-white/55">
        {examples.map((example) => (
          <button
            key={example}
            className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
            type="button"
            onClick={() => {
              onExampleClick(example);
            }}
          >
            {example}
          </button>
        ))}
      </div>
    </section>
  );
}
