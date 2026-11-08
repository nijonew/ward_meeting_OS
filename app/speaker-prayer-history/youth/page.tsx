import { SpeakerPrayerCategoryPage } from "@/components/speaker-prayer-history/SpeakerPrayerCategoryPage";
import { speakerBucket } from "@/components/speaker-prayer-history/HistoryListCard";

export default function SpeakerPrayerHistoryYouthPage() {
  return (
    <SpeakerPrayerCategoryPage
      title="Speakers (Youth)"
      category="speaker_youth"
      noteKey="speaking_note"
      filter={(e) => (e.role === "Speaker" || e.role === "Youth Speaker") && speakerBucket(e) === "youth"}
    />
  );
}
