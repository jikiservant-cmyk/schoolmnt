with open("app/dashboard/people/AddPersonForm.tsx", "r") as f:
    content = f.read()

# Add a note about the auto-generated PINs
note = """
        {/* Auto-generation note */}
        <div className="bg-meridian-gold/10 text-meridian-gold text-[11px] p-3 rounded-lg flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Biometric Enrollment IDs (PINs) are now <strong>auto-generated</strong> by the system to ensure uniqueness across all teachers and students. You can view them in the table after registration.
          </p>
        </div>
"""

content = content.replace('{/* Student Guardian Details */}', note + '\n        {/* Student Guardian Details */}')

with open("app/dashboard/people/AddPersonForm.tsx", "w") as f:
    f.write(content)
