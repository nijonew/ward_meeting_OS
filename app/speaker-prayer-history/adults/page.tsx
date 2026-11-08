import { SpeakerPrayerCategoryPage } from "@/components/speaker-prayer-history/SpeakerPrayerCategoryPage";
import { speakerBucket } from "@/components/speaker-prayer-history/HistoryListCard";

export default function SpeakerPrayerHistoryAdultsPage() {
  return (
    <SpeakerPrayerCategoryPage
      title="Speakers (Adults)"
      category="speaker_adult"
      noteKey="speaking_note"
      filter={(e) => (e.role === "Speaker" || e.role === "Youth Speaker") && speakerBucket(e) === "adult"}
    />
  );
}
