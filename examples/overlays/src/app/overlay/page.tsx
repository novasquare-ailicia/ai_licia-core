import OverlayRuntime from "./runtime";

export const dynamic = "force-static";
export const revalidate = 0;

interface OverlayPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

const OverlayPage = ({ searchParams }: OverlayPageProps) => {
  return <OverlayRuntime initialParams={searchParams} />;
};

export default OverlayPage;
