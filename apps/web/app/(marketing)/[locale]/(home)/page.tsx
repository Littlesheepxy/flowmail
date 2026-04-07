import { BottomCTA } from "@marketing/home/components/BottomCTA";
import { FaqSection } from "@marketing/home/components/FaqSection";
import { Features } from "@marketing/home/components/Features";
import { Hero } from "@marketing/home/components/Hero";
import { HowItWorks } from "@marketing/home/components/HowItWorks";
import { MetricsSection } from "@marketing/home/components/MetricsSection";
import { NotificationSection } from "@marketing/home/components/NotificationSection";
import { SecuritySection } from "@marketing/home/components/SecuritySection";
import { TrustBar } from "@marketing/home/components/TrustBar";
import { setRequestLocale } from "next-intl/server";

export default async function Home({
	params,
}: {
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	setRequestLocale(locale);

	return (
		<>
			<Hero />
			<TrustBar />
			<HowItWorks />
			<Features />
			<MetricsSection />
			<NotificationSection />
			<SecuritySection />
			<FaqSection />
			<BottomCTA />
		</>
	);
}
