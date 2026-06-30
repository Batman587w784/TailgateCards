**Vizio AI \- Project Vulpecula**

**Project Requirements Document**  
**(PRD)**

**Nov 21, 2025**

**Prepared by Fulya Duman, Project Lead @ Vizio AI (fulya@vizio.ai)**

## **Document Purpose** {#this-prd-reflects-the-finalized-scope,-timeline,-and-investment-plan-as-of-november-20,-2025,-and-serves-as-the-reference-document-for-the-tailgate-mvp-delivery.}

This document outlines the **Product Requirements** for the **Tailgate NFC Fundraising & Merch Platform (MVP)**.

It defines the platform’s **objectives, user roles, deliverables, acceptance criteria, milestones, and investment plan**.

The PRD ensures that all stakeholders share a unified understanding of what will be built, how it will function, and what defines successful delivery.  
It acts as a foundational reference for development, design, and quality assurance throughout the MVP phase.

## **Table of Contents** {#table-of-contents}

[**Document Purpose	1**](#this-prd-reflects-the-finalized-scope,-timeline,-and-investment-plan-as-of-november-20,-2025,-and-serves-as-the-reference-document-for-the-tailgate-mvp-delivery.)

[**Table of Contents	2**](#table-of-contents)

[**1\. Introduction	3**](#1.-introduction)

[**2\. Platform Overview	4**](#2.-platform-overview)

[User Roles	4](#user-roles)

[**3\. Problem & Solution Summary	5**](#3.-problem-&-solution-summary)

[Problems	5](#problems)

[Solutions	5](#solutions)

[**4\. Scope & Deliverables	6**](#4.-scope-&-deliverables)

[M1 \- Mobile & Web Design & Requirements Gathering	6](#m1---mobile-&-web-design-&-requirements-gathering)

[M2 \- Cardholder & Super Admin Logins & Dashboards	6](#m2---cardholder-&-super-admin-logins-&-dashboards)

[M2 (1/2) \- Cardholder Login & Dashboard	6](#m2-\(1/2\)---cardholder-login-&-dashboard)

[M2 (2/2) \- Super Admin Login & Dashboard	7](#m2-\(2/2\)---super-admin-login-&-dashboard)

[M3 \- Organization & Merchant Logins & Dashboards	8](#m3---organization-&-merchant-logins-&-dashboards)

[M3 (1/2) \- Organization Logins & Dashboards	8](#m3-\(1/2\)---organization-logins-&-dashboards)

[M3 (1/2) \- Merchant Logins & Dashboards	8](#m3-\(1/2\)---merchant-logins-&-dashboards)

[M4 \- Payment System Integration (Stripe)	9](#m4---payment-system-integration-\(stripe\))

[M5 \- Testing Phase	10](#m5---testing-phase)

[**5\. User Flows	11**](#5.-user-flows)

[Cardholder	11](#cardholder)

[Super Admin	11](#super-admin)

[Organization Admin	12](#organization-admin)

[Distributor	12](#distributor)

[Merchant	12](#merchant)

[**6\. Tech Stack	13**](#6.-tech-stack)

[**7\. Milestones & Timeline (Adjusted)	14**](#7.-milestones-&-timeline-\(adjusted\))

[**8\. Investment Schedule (Adjusted)	15**](#8.-investment-schedule-\(adjusted\))

[**9\. Risk Management	15**](#9.-risk-management)

[**10\. Contingency & Adjustments	16**](#10.-contingency-&-adjustments)

---

## **1\. Introduction** {#1.-introduction}

**Project Name:** Tailgate NFC Fundraising & Merch Platform  
**Client:** Sean Huffman (Open Season Photography LLC)  
**Prepared By:** Vizio Ventures  
**Date:** November 20, 2025

**Product Objective:**  
Tailgate aims to modernize college fundraising through NFC-enabled cards that connect supporters with exclusive local business discounts.  
This MVP version establishes the foundation for a digital ecosystem for **Cardholders**, **Organization Admins**, **Organization Ambassadors**, **Merchant Owners**, **Merchant Staff**, and **Super Admins**, focusing on NFC-based card activation, redemption tracking, and transparent revenue management.

## 

## 

## 

## 

## 

## 

## **2\. Platform Overview** {#2.-platform-overview}

The **Tailgate Platform** connects organizations, merchants, and supporters through a unified fundraising and discount ecosystem.  
It introduces NFC-enabled cards that replace manual fundraising tools and allows digital management of campaigns, merchant partnerships, and discount validation.

### **User Roles** {#user-roles}

* **Cardholder:** Activates NFC cards, browses and redeems discounts, and tracks usage.  
* **Organization Admin:** Oversees organization-level sales, earnings, and team performance.  
* **Distributor:** Promotes and sells NFC cards on behalf of the organization.  
* **Merchant:** Validates discounts in person via NFC scan. Reviews analytics for card usage upon entering the required dashboard passcode.   
* **Super Admin:** Oversees all users, organizations, merchants while managing platform-wide payments and data visibility.

The system will launch as a **Progressive Web App (PWA)** supporting both **mobile** and **desktop** devices (tablet support excluded for MVP).

## 

## 

## 

## **3\. Problem & Solution Summary** {#3.-problem-&-solution-summary}

### **Problems** {#problems}

* Manual, paper-based fundraising processes lack efficiency and transparency.  
* Fundraising groups struggle to track card activations and real-time revenue.  
* Merchants cannot verify discount eligibility quickly.  
* Payouts between merchants, organizations, and platform operators are slow and error-prone.

### **Solutions** {#solutions}

* NFC-based fundraising and discount validation system.  
* Real-time analytics dashboards for organizations and merchants.  
* Simple merchant-side NFC validation to confirm redemption.  
* Streamlined payment management through Stripe integration.

## **4\. Scope & Deliverables** {#4.-scope-&-deliverables}

### **M1 \- Mobile & Web Design & Requirements Gathering** {#m1---mobile-&-web-design-&-requirements-gathering}

**Scope:** Design a responsive, user-friendly PWA with a clear landing page and guided user flow.  
**Deliverables:**

* Landing page with clear CTAs and sign-in options for 5 user types.  
* Information drop forms for new organizations and merchants.  
* User flows and onboarding screens.  
* Responsive layouts optimized for mobile and desktop.   
  *(tablet is not included at this stage)*

**Acceptance Criteria:**

1. **Cardholders** can register and begin onboarding easily.  
2. **Designs** are visually consistent, intuitive, and responsive across devices.

---

### **M2 \- Cardholder & Super Admin Logins & Dashboards** {#m2---cardholder-&-super-admin-logins-&-dashboards}

#### **M2 (1/2) \- Cardholder Login & Dashboard** {#m2-(1/2)---cardholder-login-&-dashboard}

**Scope:** Develop user login, NFC activation, discount browsing, and usage tracking.  
**Deliverables:**

* Secure login and registration pages.  
* NFC activation flow.  
* Discount browsing and usage history pages.

**Acceptance Criteria:**

1. **Cardholders** can log in.  
2. **Cardholders** can activate NFC cards.   
3. **Cardholders** can browse offers.  
4. **Cardholders** can track redemption and expiration.

---

#### **M2 (2/2) \- Super Admin Login & Dashboard** {#m2-(2/2)---super-admin-login-&-dashboard}

**Scope:** Provide **Super Admins** visibility into all user groups, card activity, and payments.  
**Deliverables:**

* Dashboard displaying up-to-date statistics for cards, transactions, and platform usage.  
* Discount creation and management dashboard.  
* Admin tools for managing users, organizations, and merchants.  
* Stripe transaction visibility.

**Acceptance Criteria:**

1. **Super Admins** can view platform-wide data; including revenue flow, card usage and performance per organization.  
2. **Super Admins** can configure or deactivate organizations or merchant accounts.  
3. **Super Admins** can create campaigns and discounts for partner merchants.  
4. **Super Admins** can turn-on/turn-off cash payment option for organizations. 

### **M3 \- Organization & Merchant Logins & Dashboards** {#m3---organization-&-merchant-logins-&-dashboards}

#### **M3 (1/2) \- Organization Logins & Dashboards** {#m3-(1/2)---organization-logins-&-dashboards}

**Scope:** Build different organization interfaces for **Organization Admins** and **Distributors.**  
**Deliverables:**

* Sales and activation tracking dashboard.  
* Earnings and performance analytics.  
* Role-based views for Distributors vs. Organization Admins.

**Acceptance Criteria:**

1. **Organization Admins** can view team performance and revenue summaries.  
2. **Organization Admins** can configure or deactivate distributor accounts.  
3. **Distributors** can view their own card sales and contribution totals.  
4. **Distributors** can mark card sales with cash payments.

---

#### **M3 (1/2) \- Merchant Logins & Dashboards** {#m3-(1/2)---merchant-logins-&-dashboards}

**Scope:** Develop merchant interfaces for both validating cards and tracking analytics.  
**Deliverables:**

* NFC validation screen for Merchant Staff at POS.  
* Redemption analytics and performance metrics.

**Acceptance Criteria:**

1. **Merchants** can validate cardholder redemptions instantly through NFC scan.  
2. **Merchants** can view their active discount campaign.  
3. **Merchants** can view their analytics if the user has the dashboard passcode.

   

---

### **M4 \- Payment System Integration (Stripe)** {#m4---payment-system-integration-(stripe)}

**Scope:** Integrate Stripe to manage payments, track transactions, and ensure transparent reporting.  
**Deliverables:**

* Stripe setup for processing and logging payments.  
* Transaction visibility for merchants and admins.  
* Error and refund management workflow.

**Acceptance Criteria:**

1. **Super Admins** can monitor all Stripe transactions and payouts.

### 

### **M5 \- Testing Phase** {#m5---testing-phase}

**Scope:** Conduct platform-wide testing for stability, user experience, and NFC reliability.  
**Deliverables:**

* Functional testing across all user roles.  
* UAT and final bug fixing.  
* Performance optimization and documentation.

**Acceptance Criteria:**

1. All roles (**Cardholder**, **Organization Manager**, **Organization Ambassador**, **Merchant Owner**, **Merchant Staff**, **Super Admin**) can complete intended tasks\* without major errors.   
2. System passes 1-week UAT with critical issues resolved pre-launch.

*\***Intended tasks** include Acceptance Criteria sections and User Flow content in this document.*

## **5\. User Flows** {#5.-user-flows}

### **Cardholder** {#cardholder}

1. Visit the landing page.  
2. Activate NFC card.  
   → *Account automatically created with Stripe information.*   
3. Change account info *(email)* or log in (*optional).*  
   1. Browse and redeem discounts (*optional).*  
   2. Track card usage and expiration timeline (*optional).*

      

### **Super Admin** {#super-admin}

1. Log in to the super admin account.   
2. Manage all users, organizations, merchants, and discounts/campaigns.  
3. Monitor real-time card activity and transaction summaries.  
4. Monitor sales and performance per organization, merchant, and cardholder.

### 

### **Organization Admin** {#organization-admin}

1. Log in to the organization admin account.  
2. Add or remove distributor.  
3. Assign card batches to distributors.  
4. Monitor organization-wide sales, revenue and card activations.  
5. Access analytics and reports.

   

### **Distributor** {#distributor}

1. Log in to the distributor account.  
2. View assigned card batches.  
3. Register new cardholders.  
   Scan a new card or enter card ID for a new sale.   
   If paid;  
   1. …via Stripe → *Get payment confirmation on the platform.*  
   2. …via cash → Mark payment as cash on the platform.  
4. Monitor personal sales and progress.

### **Merchant** {#merchant}

1. Log in to the merchant account.  
2. Validate discounts using NFC.   
3. Monitor redemption performance via analytics interface with the dashboard passcode.  
4. Confirm or reject card usage in case of inactive card scans. *(optional)*

   

## **6\. Tech Stack** {#6.-tech-stack}

| Layer | Technology | Purpose |
| ----- | ----- | ----- |
| **Frontend** | React.js / Next.js | Build fast, responsive user interfaces. |
| **Backend** | Node.js | Handle APIs, logic, and data management. |
| **Database** | Supabase (PostgreSQL) | Store user, card, and transaction data. |
| **Authentication** | Supabase Auth | Secure role-based user access. |
| **Payments** | Stripe | Payment processing and transaction tracking. |
| **Hosting** | Azure | Cloud hosting and scalability. |
| **Design** | Figma | UI/UX wireframes and design collaboration. |
| **Project Management** | ClickUp, Slack, Zoom | Coordination and task tracking. |

**Table 1:** Tech Stack

## 

## 

## 

## **7\. Milestones & Timeline (Adjusted)** {#7.-milestones-&-timeline-(adjusted)}

| Module/Phase | Deliverable | Timeline |
| :---- | :---- | :---: |
| **Mobile & Web Design & Requirements** | Landing page, user flow, responsive design | Week 3 |
| **Cardholder Login & Dashboard** | User login, discount browsing, card expiry view | Week 4 |
| **Super Admin Login & Dashboard** | Platform-wide analytics & management | Week 4 |
| **Organization Logins & Dashboards** | Manager & Ambassador views for sales tracking | Week 5 |
| **Merchant Logins & Dashboards** | Merchant Owner & Merchant Staff interfaces | Week 5 |
| **Payment System Integration (Stripe)** | Stripe setup and transaction management | Week 7 |
| **Testing Phase** | 1 week of functional & performance testing | Week 8 |
| **Post-launch Maintenance Period** | 2 weeks of corrective maintenance *(Doesn’t include functional changes, enhancements and new feature development)* | Week 10 |

**Table 2:** Adjusted Milestones & Timeline

##     

## **8\. Investment Schedule (Adjusted)** {#8.-investment-schedule-(adjusted)}

| Milestone | Phase | Due Date |
| :---- | :---- | :---: |
| **M0** | Initial Payment | October 31, 2025 |
| **M1** | Mobile & Web Design & Requirements | November 21, 2025 |
| **M2** | Cardholder Login & Dashboard \+ Super Admin Dashboard | November 28, 2025 |
| **M3** | Organization Logins & Dashboards \+ Merchant Logins | December 12, 2025 |
| **M4** | Payment System Integration | December 19, 2025 |
| **M5** | Testing Phase | December 26, 2025 |
| **Post-launch Maintenance Period** | 2 weeks of corrective maintenance | January 9, 2026 |

**Table 3:** Adjusted Milestones & Timeline

## **9\. Risk Management** {#9.-risk-management}

**Potential Risks:**

* Delays in NFC integration or hardware compatibility.  
* Stripe API or payout delays.  
* Performance issues under concurrent loads.

**Mitigation Plans:**

* Conduct NFC compatibility tests early.  
* Use Stripe sandbox *(if available)* for early integration testing.  
* Perform load tests before final deployment.

## **10\. Contingency & Adjustments** {#10.-contingency-&-adjustments}

Vizio AI’s **limits of liability** is outlined in this document. 

Vizio AI's outputs are determined by the document's scope, and the "**Definition of Done**" depends on completing the Acceptance Criteria and User Flow content. Achieving agreed-upon “Definition of Done” indicates **milestone completion**. 

However, agreed-upon functionality within these sections **can be modified** during development, considering effort, if both parties consent. This highlights the importance of clear agreements and the flexibility to adapt during the development lifecycle.

Anything outside of the defined scope will be evaluated according to information below.

* **Development Effort:** 250 hours with 10% contingency (25 hours).  
* **Scope Changes:** Any new features trigger a review for updated budget/timeline.

**This PRD reflects the finalized scope, timeline, and investment plan as of November 20, 2025, and serves as the reference document for the Tailgate MVP delivery.**