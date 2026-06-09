import { NextResponse } from "next/server";
import { GradeApiError, gradeRecreation } from "@/lib/grader";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const original = formData.get("original");
    const recreated = formData.get("recreated");

    if (!(original instanceof File) || !(recreated instanceof File)) {
      return NextResponse.json({ error: "Upload both the original source file and recreated file." }, { status: 400 });
    }

    const result = await gradeRecreation(original, recreated);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GradeApiError) {
      return NextResponse.json(
        {
          error: error.code,
          message: error.message,
          debugHint: error.debugHint,
        },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : "Unable to grade these files.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
