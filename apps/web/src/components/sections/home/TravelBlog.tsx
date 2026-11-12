import { ArrowUpRight } from "lucide-react";
import { blogPosts } from "@/content/blog";
import { Reveal } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/Button";
import { BlogCard, BlogRow } from "../blog/BlogCard";
import { SectionHeading } from "../SectionHeading";

/** Trip plans and sightseeing notes from the blog: one feature card and the rest as a list. */
export function TravelBlog() {
  const [feature, ...rest] = blogPosts;
  if (!feature) return null;
  return (
    <section aria-labelledby="blog-title" className="bg-surface-sunken py-16 lg:py-24">
      <div className="container-editorial flex flex-col gap-10 lg:gap-14">
        <SectionHeading
          eyebrow="From the blog"
          title={<span id="blog-title">Trip plans you can follow</span>}
          intro="A one-day trip, a full week down the coast, a sightseeing list and three ways to plan Uttara Kannada."
          action={
            <Button href="/blog" variant="secondary" trailingIcon={<ArrowUpRight className="size-4" />}>
              All articles
            </Button>
          }
        />
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
          <Reveal className="lg:col-span-7">
            <BlogCard post={feature} size="lg" />
          </Reveal>
          <ul className="flex flex-col divide-y divide-line-strong border-y border-line-strong lg:col-span-5 lg:self-start">
            {rest.map((post, i) => (
              <Reveal as="li" key={post.slug} delay={i * 0.06}>
                <BlogRow post={post} />
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
