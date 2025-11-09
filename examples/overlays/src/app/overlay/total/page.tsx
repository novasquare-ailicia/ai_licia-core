import OverlayRuntime from "../runtime";

export const dynamic = "force-static";
export const revalidate = false;

const TotalOverlayPage = () => {
  return <OverlayRuntime mode="total-rate" />;
};

export default TotalOverlayPage;
