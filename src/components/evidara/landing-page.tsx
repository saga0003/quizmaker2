'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import {
  Shield,
  TrendingUp,
  Users,
  Trophy,
  ArrowRight,
  Check,
  Star,
  Zap,
  Menu,
  X,
  BarChart3,
  BookOpen,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAppStore } from '@/store/use-app-store';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: 'easeOut' as const },
  }),
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } },
};

const features = [
  {
    icon: Shield,
    title: 'Secure Assessments',
    description:
      'Full-screen proctored exams with auto-grading, question shuffling, and violation detection.',
  },
  {
    icon: TrendingUp,
    title: 'Student Intelligence',
    description:
      'Deep analytics with error-cause analysis, topic mastery, and segment-based development plans.',
  },
  {
    icon: Users,
    title: 'School Platform',
    description:
      'Question bank, paper builder, student lifecycle management, and resource governance.',
  },
  {
    icon: Trophy,
    title: 'Benchmarks & Achievements',
    description:
      'Cross-school benchmark publications, achievement badges, and verifiable certificates.',
  },
];

const pricingPlans = [
  {
    name: 'School Starter',
    price: '₹5,999',
    period: '/year',
    originalPrice: '₹9,999',
    description: 'Best for small schools',
    features: [
      'Up to 200 students',
      'Secure proctored exams',
      'Basic analytics dashboard',
      'Question bank access',
      'Email support',
    ],
    cta: 'Start Free Trial',
    popular: false,
  },
  {
    name: 'School Pro',
    price: '₹18,999',
    period: '/year',
    originalPrice: '₹24,999',
    description: 'Most popular',
    features: [
      'Unlimited students',
      'Advanced proctoring & analytics',
      'Paper builder & question bank',
      'Student intelligence reports',
      'Achievement certificates',
      'Priority support',
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    originalPrice: '',
    description: 'For large institutions and chains',
    features: [
      'Everything in School Pro',
      'Multi-campus management',
      'Custom integrations',
      'Dedicated account manager',
      'SLA guarantees',
      'On-premise deployment option',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

const trustedSchools = [
  'Green Valley High',
  'Delhi Public School',
  'St. Mary\'s Academy',
  'Modern International',
  'Heritage School',
  'Ryan International',
];

const footerLinks = {
  Platform: [
    'Assessments',
    'Analytics',
    'Question Bank',
    'Paper Builder',
    'Achievements',
  ],
  Company: ['About Us', 'Careers', 'Blog', 'Press', 'Partners'],
  Legal: [
    'Privacy Policy',
    'Terms of Service',
    'Cookie Policy',
    'GDPR',
    'Data Security',
  ],
  Support: [
    'Help Center',
    'Contact Us',
    'Status Page',
    'Community',
    'API Docs'],
};

export default function LandingPage() {
  const setView = useAppStore((s) => s.setView);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9F7]">
      {/* ─── NAVBAR ─── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-[#E7ECEB]">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <Image
              src="/brand/evidara-logo-dark.png"
              alt="Evidara"
              width={140}
              height={36}
              className="h-9 w-auto"
              priority
            />
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-8">
            {['Platform', 'For Schools', 'Analytics', 'Pricing'].map((link) => (
              <a
                key={link}
                href={`#${link.toLowerCase().replace(/\s+/g, '-')}`}
                className="text-sm font-medium text-[#6B7980] hover:text-[#14232B] transition-colors"
              >
                {link}
              </a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Button
              variant="outline"
              className="border-[#E7ECEB] text-[#14232B] hover:bg-[#F7F9F7]"
              onClick={() => setView('login')}
            >
              Sign In
            </Button>
            <Button
              className="bg-[#0E5A5A] hover:bg-[#0a4a4a] text-white"
              onClick={() => setView('login')}
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          {/* Mobile Hamburger */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-[#F7F9F7] transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5 text-[#14232B]" />
            ) : (
              <Menu className="h-5 w-5 text-[#14232B]" />
            )}
          </button>
        </nav>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-[#E7ECEB] bg-white"
          >
            <div className="px-4 py-4 space-y-3">
              {['Platform', 'For Schools', 'Analytics', 'Pricing'].map((link) => (
                <a
                  key={link}
                  href={`#${link.toLowerCase().replace(/\s+/g, '-')}`}
                  className="block text-sm font-medium text-[#6B7980] hover:text-[#14232B] py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link}
                </a>
              ))}
              <Separator className="my-2" />
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  variant="outline"
                  className="w-full border-[#E7ECEB] text-[#14232B]"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setView('login');
                  }}
                >
                  Sign In
                </Button>
                <Button
                  className="w-full bg-[#0E5A5A] hover:bg-[#0a4a4a] text-white"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setView('login');
                  }}
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </header>

      <main className="flex-1">
        {/* ─── HERO SECTION ─── */}
        <section className="relative overflow-hidden">
          {/* Subtle gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#14232B]/[0.04] via-[#0E5A5A]/[0.06] to-transparent pointer-events-none" />
          <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-[#0E5A5A]/[0.03] rounded-full blur-3xl pointer-events-none" />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left — Text */}
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
              >
                <motion.div variants={fadeUp} custom={0}>
                  <Badge
                    variant="secondary"
                    className="mb-6 bg-[#DCE9E7] text-[#0E5A5A] border-0 px-4 py-1.5 text-sm font-medium"
                  >
                    <Zap className="mr-1.5 h-3.5 w-3.5" />
                    Trusted by 60+ schools across India
                  </Badge>
                </motion.div>

                <motion.h1
                  variants={fadeUp}
                  custom={1}
                  className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#14232B] leading-tight tracking-tight"
                >
                  Evidence-Driven{' '}
                  <span className="text-[#0E5A5A]">Student Development</span>
                </motion.h1>

                <motion.p
                  variants={fadeUp}
                  custom={2}
                  className="mt-6 text-lg sm:text-xl text-[#6B7980] leading-relaxed max-w-xl"
                >
                  Subscription-based school assessments, previous-year resources,
                  secure exams and student intelligence for Grades 8–12.
                </motion.p>

                <motion.div
                  variants={fadeUp}
                  custom={3}
                  className="mt-8 flex flex-wrap gap-4"
                >
                  <Button
                    size="lg"
                    className="bg-[#F2B84B] hover:bg-[#e5a93a] text-[#14232B] font-semibold px-8 h-12 text-base"
                    onClick={() => setView('login')}
                  >
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-[#E7ECEB] text-[#14232B] hover:bg-[#F7F9F7] px-8 h-12 text-base"
                  >
                    <BookOpen className="mr-2 h-4 w-4" />
                    Watch Demo
                  </Button>
                </motion.div>

                <motion.div
                  variants={fadeUp}
                  custom={4}
                  className="mt-8 flex items-center gap-6 text-sm text-[#6B7980]"
                >
                  <span className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-[#0E5A5A]" />
                    14-day free trial
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-[#0E5A5A]" />
                    No credit card required
                  </span>
                </motion.div>
              </motion.div>

              {/* Right — Dashboard Mockup */}
              <motion.div
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="relative hidden lg:block"
              >
                <div className="relative rounded-2xl bg-white border border-[#E7ECEB] shadow-2xl shadow-[#14232B]/[0.06] p-6 max-w-md ml-auto">
                  {/* Mock dashboard header */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-xs text-[#6B7980] font-medium">Student Performance</p>
                      <p className="text-lg font-bold text-[#14232B]">Grade 10 — Math</p>
                    </div>
                    <Badge className="bg-[#DCE9E7] text-[#0E5A5A] border-0 text-xs">
                      Live
                    </Badge>
                  </div>

                  {/* Mock stat cards */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {[
                      { label: 'Avg. Score', value: '78%', change: '+5%', icon: TrendingUp },
                      { label: 'Students', value: '1,248', change: '+12%', icon: Users },
                      { label: 'Papers', value: '42', change: '8 new', icon: BookOpen },
                      { label: 'Pass Rate', value: '94%', change: '+2%', icon: Star },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-lg bg-[#F7F9F7] p-3.5"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <stat.icon className="h-3.5 w-3.5 text-[#0E5A5A]" />
                          <span className="text-xs text-[#6B7980]">{stat.label}</span>
                        </div>
                        <div className="flex items-end gap-2">
                          <span className="text-lg font-bold text-[#14232B]">
                            {stat.value}
                          </span>
                          <span className="text-xs text-[#0E5A5A] font-medium">
                            {stat.change}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Mock chart bars */}
                  <div className="space-y-2.5">
                    {[
                      { label: 'Algebra', pct: 85 },
                      { label: 'Geometry', pct: 72 },
                      { label: 'Trigonometry', pct: 63 },
                      { label: 'Statistics', pct: 91 },
                    ].map((bar) => (
                      <div key={bar.label} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-[#6B7980]">{bar.label}</span>
                          <span className="font-medium text-[#14232B]">{bar.pct}%</span>
                        </div>
                        <div className="h-2 bg-[#F7F9F7] rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${bar.pct}%` }}
                            transition={{ duration: 1, delay: 0.6, ease: 'easeOut' as const }}
                            className="h-full rounded-full"
                            style={{
                              background:
                                bar.pct >= 80
                                  ? '#0E5A5A'
                                  : bar.pct >= 70
                                    ? '#2E6D8B'
                                    : '#F2B84B',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Floating badge */}
                  <div className="absolute -top-4 -right-4 bg-[#0E5A5A] text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg">
                    <Trophy className="inline mr-1 h-3 w-3" />
                    Top Performer
                  </div>
                </div>

                {/* Decorative elements */}
                <div className="absolute -z-10 top-8 -left-8 w-32 h-32 bg-[#DCE9E7] rounded-2xl opacity-60" />
                <div className="absolute -z-10 -bottom-6 left-16 w-24 h-24 bg-[#F2B84B]/20 rounded-2xl" />
              </motion.div>
            </div>
          </div>
        </section>

        {/* ─── FEATURES GRID ─── */}
        <section id="platform" className="py-20 lg:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              className="text-center max-w-2xl mx-auto mb-14"
            >
              <motion.p
                variants={fadeUp}
                custom={0}
                className="text-sm font-semibold text-[#0E5A5A] uppercase tracking-wider mb-3"
              >
                Platform Features
              </motion.p>
              <motion.h2
                variants={fadeUp}
                custom={1}
                className="text-3xl sm:text-4xl font-bold text-[#14232B] tracking-tight"
              >
                Everything your school needs for{' '}
                <span className="text-[#0E5A5A]">assessment excellence</span>
              </motion.h2>
              <motion.p
                variants={fadeUp}
                custom={2}
                className="mt-4 text-[#6B7980] text-lg"
              >
                From secure exams to deep analytics, Evidara provides an
                end-to-end platform for student development.
              </motion.p>
            </motion.div>

            <div className="grid sm:grid-cols-2 gap-6">
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-40px' }}
                  variants={fadeUp}
                  custom={i}
                >
                  <Card className="group h-full border-[#E7ECEB] bg-white hover:shadow-xl hover:shadow-[#14232B]/[0.05] transition-all duration-300 hover:-translate-y-1">
                    <CardContent className="p-6 lg:p-8">
                      <div className="w-12 h-12 rounded-xl bg-[#DCE9E7] flex items-center justify-center mb-5 group-hover:bg-[#0E5A5A] transition-colors duration-300">
                        <f.icon className="h-6 w-6 text-[#0E5A5A] group-hover:text-white transition-colors duration-300" />
                      </div>
                      <h3 className="text-xl font-semibold text-[#14232B] mb-2">
                        {f.title}
                      </h3>
                      <p className="text-[#6B7980] leading-relaxed">
                        {f.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── TRUSTED BY ─── */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              className="text-center"
            >
              <p className="text-sm font-medium text-[#6B7980] mb-8">
                Trusted by 60+ schools across India
              </p>
              <Separator className="max-w-xs mx-auto mb-8 bg-[#E7ECEB]" />
              <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
                {trustedSchools.map((school) => (
                  <span
                    key={school}
                    className="px-5 py-2.5 rounded-full bg-[#F7F9F7] text-sm font-medium text-[#6B7980] border border-[#E7ECEB]"
                  >
                    {school}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ─── PRICING ─── */}
        <section id="pricing" className="py-20 lg:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              className="text-center max-w-2xl mx-auto mb-14"
            >
              <motion.p
                variants={fadeUp}
                custom={0}
                className="text-sm font-semibold text-[#0E5A5A] uppercase tracking-wider mb-3"
              >
                Simple Pricing
              </motion.p>
              <motion.h2
                variants={fadeUp}
                custom={1}
                className="text-3xl sm:text-4xl font-bold text-[#14232B] tracking-tight"
              >
                Plans that grow with your school
              </motion.h2>
              <motion.p
                variants={fadeUp}
                custom={2}
                className="mt-4 text-[#6B7980] text-lg"
              >
                Start free for 14 days. No credit card required.
              </motion.p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
              {pricingPlans.map((plan, i) => (
                <motion.div
                  key={plan.name}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-40px' }}
                  variants={fadeUp}
                  custom={i}
                >
                  <Card
                    className={`relative h-full flex flex-col bg-white transition-shadow duration-300 hover:shadow-xl hover:shadow-[#14232B]/[0.06] ${
                      plan.popular
                        ? 'border-2 border-[#F2B84B] shadow-lg shadow-[#F2B84B]/[0.08]'
                        : 'border border-[#E7ECEB]'
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-[#F2B84B] text-[#14232B] border-0 px-4 py-1 text-xs font-bold shadow-sm">
                          <Star className="mr-1 h-3 w-3 fill-current" />
                          Most Popular
                        </Badge>
                      </div>
                    )}
                    <CardContent className="p-6 lg:p-8 flex-1 flex flex-col">
                      <h3 className="text-lg font-semibold text-[#14232B]">
                        {plan.name}
                      </h3>
                      <p className="text-sm text-[#6B7980] mt-1">{plan.description}</p>

                      <div className="mt-6 mb-6">
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold text-[#14232B]">
                            {plan.price}
                          </span>
                          {plan.period && (
                            <span className="text-[#6B7980] text-sm">
                              {plan.period}
                            </span>
                          )}
                        </div>
                        {plan.originalPrice && (
                          <p className="text-sm text-[#B54747] mt-1">
                            <span className="line-through">{plan.originalPrice}</span>
                            <span className="ml-2 font-medium text-[#0E5A5A]">
                              Save{' '}
                              {Math.round(
                                ((parseInt(plan.originalPrice.replace(/[^\d]/g, '')) -
                                  parseInt(plan.price.replace(/[^\d]/g, ''))) /
                                  parseInt(plan.originalPrice.replace(/[^\d]/g, ''))) *
                                  100
                              )}
                              %
                            </span>
                          </p>
                        )}
                      </div>

                      <Separator className="mb-6 bg-[#E7ECEB]" />

                      <ul className="space-y-3 flex-1">
                        {plan.features.map((feature) => (
                          <li
                            key={feature}
                            className="flex items-start gap-2.5 text-sm text-[#14232B]"
                          >
                            <Check className="h-4 w-4 text-[#0E5A5A] mt-0.5 shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>

                      <Button
                        className={`mt-8 w-full h-11 text-sm font-semibold ${
                          plan.popular
                            ? 'bg-[#0E5A5A] hover:bg-[#0a4a4a] text-white'
                            : 'bg-[#F7F9F7] text-[#14232B] hover:bg-[#E7ECEB] border border-[#E7ECEB]'
                        }`}
                        onClick={() => setView('login')}
                      >
                        {plan.cta}
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CTA SECTION ─── */}
        <section className="py-20 lg:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={fadeUp}
              custom={0}
              className="relative overflow-hidden rounded-3xl bg-[#14232B] px-6 py-16 sm:px-12 sm:py-20 text-center"
            >
              {/* Decorative blobs */}
              <div className="absolute top-0 left-0 w-72 h-72 bg-[#0E5A5A]/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
              <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#2E6D8B]/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />

              <div className="relative z-10">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight max-w-2xl mx-auto">
                  Ready to transform your assessments?
                </h2>
                <p className="mt-4 text-lg text-white/70 max-w-lg mx-auto">
                  Join 60+ schools already using Evidara to drive better student
                  outcomes.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button
                    size="lg"
                    className="bg-[#F2B84B] hover:bg-[#e5a93a] text-[#14232B] font-semibold px-8 h-12 text-base"
                    onClick={() => setView('login')}
                  >
                    Start your 14-day free trial
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-4 text-sm text-white/50">
                  No credit card required · Setup in 5 minutes · Cancel anytime
                </p>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="bg-[#14232B] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-8 lg:gap-12">
            {/* Brand */}
            <div className="col-span-2">
              <Image
                src="/brand/evidara-logo-light.png"
                alt="Evidara"
                width={140}
                height={36}
                className="h-9 w-auto mb-4"
              />
              <p className="text-white/50 text-sm leading-relaxed max-w-xs">
                Evidence-driven student development platform for schools.
                Empowering Grades 8–12 with secure assessments and deep analytics.
              </p>
              <div className="mt-6 flex items-center gap-3">
                {['X', 'Li', 'Gh'].map((s) => (
                  <span
                    key={s}
                    className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium text-white/60 hover:bg-white/20 transition-colors cursor-pointer"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Link Columns */}
            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h4 className="text-sm font-semibold text-white mb-4">{title}</h4>
                <ul className="space-y-2.5">
                  {links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-sm text-white/50 hover:text-white/80 transition-colors"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-white/40">
              © 2026 Evidara. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm text-white/40 hover:text-white/60 transition-colors">
                Privacy
              </a>
              <a href="#" className="text-sm text-white/40 hover:text-white/60 transition-colors">
                Terms
              </a>
              <a href="#" className="text-sm text-white/40 hover:text-white/60 transition-colors">
                Cookies
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}