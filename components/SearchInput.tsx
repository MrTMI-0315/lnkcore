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
          className="w-full rounded-full border border-zinc-700 bg-zinc-950/80 px-6 py-4 text-center text-base text-white outline-none transition focus:border-zinc-400 focus:bg-zinc-900 sm:text-lg"
          disabled={isLoading}
          placeholder="type a core..."
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
        <div className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            className="w-full rounded-full border border-zinc-200 bg-white px-5 py-2 text-sm font-medium text-black transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-500 sm:w-auto"
            disabled={!value.trim() || isLoading}
            type="submit"
          >
            {isLoading ? "Generating..." : "Generate"}
          </button>
          <button
            className="w-full rounded-full border border-zinc-700 px-5 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800 sm:w-auto"
            disabled={isLoading}
            type="button"
            onClick={onRandom}
          >
            🎲 Random Core
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-zinc-400">
        {examples.map((example) => (
          <button
            key={example}
            className="rounded-full border border-zinc-700 px-3 py-1 text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
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
