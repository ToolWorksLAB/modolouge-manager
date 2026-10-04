import { notFound } from "next/navigation";
import JourneyPreview from "../../../components/JourneyPreview.jsx";
export default function DesignPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <JourneyPreview />;
}
