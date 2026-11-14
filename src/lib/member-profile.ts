import { z } from "zod";

export type MemberProfileKind =
  "clinical" | "staff" | "organisation" | "coach" | "athlete" | "parent" | "member";

export function profileKind(roles: readonly string[]): MemberProfileKind {
  if (roles.some((role) => ["super_admin", "vito_admin"].includes(role))) return "staff";
  if (roles.includes("school_admin")) return "organisation";
  if (roles.some((role) => ["clinical_professional", "clinical_supervisor"].includes(role)))
    return "clinical";
  if (roles.includes("coach")) return "coach";
  if (roles.includes("athlete")) return "athlete";
  if (roles.includes("parent")) return "parent";
  return "member";
}

export function memberProfileCopy(kind: MemberProfileKind) {
  switch (kind) {
    case "staff":
      return {
        editorTitle: "VITO Physio institutional profile",
        aboutLabel: "About VITO Physio",
        aboutHint:
          "Describe VITO Physio’s mission, services, and how the institution supports sports and clinical communities. Keep this about the organisation, not an individual administrator.",
        aboutPlaceholder:
          "Explain what VITO Physio does, who it serves, and the support it provides…",
        headlineLabel: "Institutional headline",
        positionLabel: "Department / focus",
        institutionLabel: "Institution",
        districtLabel: "Service district",
        countryLabel: "Operating country",
        skillsLabel: "Programmes / services",
        interestsLabel: "Institutional focus areas",
        showAccountName: false,
        showInstitutionField: false,
        showSportAndTeam: false,
      };
    case "organisation":
      return {
        editorTitle: "Institution profile",
        aboutLabel: "About the institution",
        aboutHint:
          "Describe the institution’s mission, programmes, services, and the community it serves. This is the institution’s profile, not a personal biography.",
        aboutPlaceholder: "Describe your institution, its programmes, and the people it supports…",
        headlineLabel: "Institutional headline",
        positionLabel: "Institution type / focus",
        institutionLabel: "Institution name",
        districtLabel: "Institution district",
        countryLabel: "Institution country",
        skillsLabel: "Programmes / services",
        interestsLabel: "Institutional focus areas",
        showAccountName: false,
        showInstitutionField: true,
        showSportAndTeam: false,
      };
    case "coach":
      return {
        editorTitle: "Coach profile",
        aboutLabel: "About the coach",
        aboutHint:
          "Introduce yourself as a coach. Include your coaching approach, sports experience, and the teams or institutions you work with. Do not include private athlete information.",
        aboutPlaceholder:
          "Share your coaching background, approach, and team or institution affiliations…",
        headlineLabel: "Coaching headline",
        positionLabel: "Coaching role",
        institutionLabel: "Associated institution",
        districtLabel: "District",
        countryLabel: "Country",
        skillsLabel: "Coaching expertise",
        interestsLabel: "Coaching interests",
        showAccountName: true,
        showInstitutionField: true,
        showSportAndTeam: true,
      };
    case "clinical":
      return {
        editorTitle: "Clinical professional profile",
        aboutLabel: "About the professional",
        aboutHint:
          "Summarise your professional background, clinical approach, and the people you support. Do not include identifiable patient or case information.",
        aboutPlaceholder: "Describe your clinical experience, approach, and areas of practice…",
        headlineLabel: "Professional headline",
        positionLabel: "Professional title",
        institutionLabel: "Practice / organisation",
        districtLabel: "Practice district",
        countryLabel: "Practice country",
        skillsLabel: "Specialties / skills",
        interestsLabel: "Professional interests",
        showAccountName: true,
        showInstitutionField: true,
        showSportAndTeam: false,
      };
    case "parent":
      return {
        editorTitle: "Parent / guardian profile",
        aboutLabel: "About you",
        aboutHint:
          "Share your role supporting an athlete and the sports, school, or community you are connected with. Keep children’s medical and other sensitive details private.",
        aboutPlaceholder: "Share a little about your role and the sporting community you support…",
        headlineLabel: "Profile headline",
        positionLabel: "Relationship / role",
        institutionLabel: "School / club affiliation",
        districtLabel: "District",
        countryLabel: "Country",
        skillsLabel: "Skills",
        interestsLabel: "Sports / community interests",
        showAccountName: true,
        showInstitutionField: true,
        showSportAndTeam: true,
      };
    case "athlete":
      return {
        editorTitle: "Athlete profile",
        aboutLabel: "About the athlete",
        aboutHint:
          "Share the athlete’s sporting journey, goals, and interests without adding sensitive medical information.",
        aboutPlaceholder: "Tell the community about the athlete’s sporting journey and goals…",
        headlineLabel: "Athlete headline",
        positionLabel: "Position",
        institutionLabel: "School / academy / club",
        districtLabel: "District",
        countryLabel: "Country",
        skillsLabel: "Skills",
        interestsLabel: "Interests",
        showAccountName: true,
        showInstitutionField: true,
        showSportAndTeam: true,
      };
    default:
      return {
        editorTitle: "Community profile",
        aboutLabel: "About you",
        aboutHint:
          "Share a short introduction and the ways you connect with the VITO Physio community.",
        aboutPlaceholder: "Write a short introduction…",
        headlineLabel: "Headline",
        positionLabel: "Role",
        institutionLabel: "School / organisation",
        districtLabel: "District",
        countryLabel: "Country",
        skillsLabel: "Skills",
        interestsLabel: "Interests",
        showAccountName: true,
        showInstitutionField: true,
        showSportAndTeam: false,
      };
  }
}

export function profileDisplayName(
  role: string | null | undefined,
  fullName: string | null | undefined,
  institutionName?: string | null,
) {
  if (role === "school_admin") return institutionName?.trim() || "Institution profile";
  if (role === "super_admin" || role === "vito_admin") return "VITO Physio";
  return fullName?.trim() || "VITO Physio member";
}

export const memberProfileInput = z
  .object({
    full_name: z.string().trim().min(2).max(120),
    headline: z.string().trim().max(120),
    position: z.string().trim().max(80),
    sport: z.string().trim().max(80),
    school_name: z.string().trim().max(160),
    team: z.string().trim().max(120),
    district: z.string().trim().max(120),
    country: z.string().trim().max(120),
    bio: z.string().trim().max(1500),
    skills: z.array(z.string().trim().min(1).max(60)).max(20),
    interests: z.array(z.string().trim().min(1).max(60)).max(20),
    discoverable: z.boolean(),
    visibility: z.enum(["community", "connections"]),
  })
  .strict();
