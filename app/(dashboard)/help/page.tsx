import type { Metadata } from "next";
import { ChevronRight, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Help" };

const FAQ = [
  "How do I reschedule many posts at once?",
  "Why did my post fail to publish?",
  "Can I customize a post for each platform?",
  "How are best times to post calculated?",
];

export default function Page() {
  return (
    <div className="mx-auto max-w-[760px]">
      <PageHeader title="Help" description="Guides, answers, and a human when you need one." />
      <div className="flex flex-col gap-2">
        {FAQ.map((q) => (
          <a key={q} href="#" className="surface surface-lift flex items-center justify-between px-4 py-3.5">
            <span className="text-[13.5px]">{q}</span><ChevronRight size={15} className="text-dim" />
          </a>
        ))}
      </div>
      <Button variant="primary" className="mt-5"><MessageCircle size={15} />Chat with support</Button>
    </div>
  );
}
