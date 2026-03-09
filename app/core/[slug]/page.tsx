import { CoreExperience } from "@/components/CoreExperience";
import { slugToKeyword } from "@/lib/cores";

type CorePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function CorePage({ params }: CorePageProps) {
  const { slug } = await params;

  return <CoreExperience initialKeyword={slugToKeyword(slug)} />;
}
