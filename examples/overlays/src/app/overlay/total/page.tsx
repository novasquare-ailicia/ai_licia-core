import OverlayRuntime from "../runtime";

export const dynamic = "force-static";
export const revalidate = 0;

interface TotalOverlayPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

const TotalOverlayPage = ({ searchParams }: TotalOverlayPageProps) => {
  return <OverlayRuntime initialParams={searchParams} mode="total-rate" />;
};

export default TotalOverlayPage;
