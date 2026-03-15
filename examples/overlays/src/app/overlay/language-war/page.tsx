import LanguageWarRuntime from "./runtime";

export const dynamic = "force-static";
export const revalidate = false;

const LanguageWarOverlayPage = () => {
  return <LanguageWarRuntime />;
};

export default LanguageWarOverlayPage;
