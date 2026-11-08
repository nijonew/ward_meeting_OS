import { SpeakerPrayerCategoryPage } from "@/components/speaker-prayer-history/SpeakerPrayerCategoryPage";

export default function SpeakerPrayerHistoryPrayersPage() {
  return (
    <SpeakerPrayerCategoryPage
      title="Prayers"
      category="prayer"
      noteKey="praying_note"
      filter={(e) => e.role === "Opening Prayer" || e.role === "Closing Prayer" || e.role === "Prayer"}
    />
  );
}
