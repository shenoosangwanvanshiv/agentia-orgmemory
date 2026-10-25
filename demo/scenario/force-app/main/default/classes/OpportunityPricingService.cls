public with sharing class OpportunityPricingService {
    public static Decimal applyTier(Opportunity opp) {
        if (opp == null || opp.Amount == null) {
            return 0;
        }
        return opp.Amount;
    }
}
