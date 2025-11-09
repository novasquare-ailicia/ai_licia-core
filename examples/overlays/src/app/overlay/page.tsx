import OverlayRuntime from "./runtime";

export const dynamic = "force-static";
export const revalidate = false;

const OverlayPage = () => {
  return <OverlayRuntime />;
};

export default OverlayPage;
