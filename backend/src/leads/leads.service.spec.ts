import { ConflictException } from "@nestjs/common";
import { LeadsService } from "./leads.service";

describe("LeadsService", () => {
  let service: LeadsService;

  beforeEach(() => {
    service = new LeadsService();
  });

  it("creates unique human-readable tokens and rejects duplicate emails", () => {
    const first = service.create({
      companyName: "Northstar",
      email: "sales@northstar.example",
    });
    const second = service.create({ companyName: "Contoso" });

    expect(first.leadToken).toMatch(/^HW-\d{4}-\d{6}$/);
    expect(second.leadToken).not.toBe(first.leadToken);
    expect(() =>
      service.create({
        companyName: "Different company",
        email: "SALES@NORTHSTAR.EXAMPLE",
      }),
    ).toThrow(ConflictException);
  });

  it("enforces status transitions and prevents re-enabling suppressed leads", () => {
    const lead = service.create({ companyName: "Northstar" });
    expect(() => service.update(lead.id, { status: "CUSTOMER" })).toThrow(
      ConflictException,
    );

    service.suppress(lead.id, "operator request");
    expect(() => service.update(lead.id, { status: "DISCOVERED" })).toThrow(
      ConflictException,
    );
  });

  it("does not partially modify a lead when an update is invalid", () => {
    const lead = service.create({ companyName: "Northstar", email: "a@northstar.example" });

    expect(() =>
      service.update(lead.id, {
        companyName: "Changed",
        email: "not-an-email",
      }),
    ).toThrow();
    expect(service.get(lead.id).companyName).toBe("Northstar");
  });

  it("applies inbound unsubscribe and does not reactivate suppressed leads", () => {
    const lead = service.create({
      companyName: "Northstar",
      email: "reply@northstar.example",
    });

    const unsubscribed = service.applyInboundEvent(lead.email, "unsubscribe");
    const lateReply = service.applyInboundEvent(lead.email, "reply");

    expect(unsubscribed.status).toBe("UNSUBSCRIBED");
    expect(lateReply.applied).toBe(false);
    expect(lateReply.status).toBe("UNSUBSCRIBED");
    expect(service.isSuppressed(lead.email)).toBe(true);
  });

  it("bounds and explains lead scores", () => {
    const lead = service.create({ companyName: "Northstar" });

    expect(() =>
      service.updateScore(lead.id, 101, ["bad"], "HIGH_PRIORITY"),
    ).toThrow();
    const scored = service.updateScore(
      lead.id,
      82,
      ["+10: Company"],
      "HIGH_PRIORITY",
    );
    expect(scored.leadScore).toBe(82);
    expect(scored.status).toBe("DISCOVERED");
    service.suppress(lead.id, "test");
    expect(() =>
      service.updateScore(lead.id, 30, ["reason"], "LOW"),
    ).toThrow(ConflictException);
  });
});
