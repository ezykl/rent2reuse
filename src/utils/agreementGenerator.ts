export interface AgreementData {
  rentalId: string;
  ownerName: string;
  renterName: string;
  itemName: string;
  itemDescription: string;
  rentalPrice: number;
  downpaymentAmount: number;
  downpaymentPercentage: number;
  remainingAmount: number;
  startDate: Date;
  endDate: Date;
  rentalDays: number;
  pickupTime: string;
  pickupLocation: string;
  termsAndConditions: string;
  cancellationPolicy: string;
  damagePolicy: string;
}

export const generateAgreementText = (data: AgreementData): string => {
  return `
RENTAL AGREEMENT

Rental ID: ${data.rentalId}
Date: ${new Date().toLocaleDateString()}

PARTIES:
Owner: ${data.ownerName}
Renter: ${data.renterName}

ITEM DETAILS:
Item: ${data.itemName}
Description: ${data.itemDescription}

RENTAL PERIOD:
Start Date: ${data.startDate.toLocaleDateString()}
End Date: ${data.endDate.toLocaleDateString()}
Duration: ${data.rentalDays} days

PICKUP:
Time: ${data.pickupTime}
Location: ${data.pickupLocation}

PAYMENT TERMS:
Total Rental Price: ₱${data.rentalPrice.toLocaleString()}
Down Payment (${data.downpaymentPercentage}%): ₱${data.downpaymentAmount.toLocaleString()}
Remaining Balance: ₱${data.remainingAmount.toLocaleString()}

TERMS AND CONDITIONS:
${data.termsAndConditions || "1. Renter agrees to keep the item in good condition.\n2. Any damage beyond normal wear and tear is the renter's responsibility.\n3. Item must be returned by the end date."}

CANCELLATION POLICY:
${data.cancellationPolicy || "Cancellations made 7 days before rental start date will receive a full refund of the down payment."}

DAMAGE POLICY:
${data.damagePolicy || "Renter is responsible for any damage incurred during the rental period. Repair costs will be deducted from the security deposit or charged separately."}

Both parties agree to the terms and conditions outlined above.

Owner Signature: ________________     Date: __________
Renter Signature: ________________    Date: __________
  `;
};

export const generateAgreementFromChatData = (
  chatData: any,
  recipientName: any,
  currentUserName: any,
  isOwner: boolean
): AgreementData => {
  const itemDetails = chatData.itemDetails || {};
  const totalPrice = itemDetails.totalPrice || 0;
  const downpaymentPercentage = itemDetails.downpaymentPercentage || 0;
  const downpaymentAmount = (totalPrice * downpaymentPercentage) / 100;
  const remainingAmount = totalPrice - downpaymentAmount;

  const startDate = itemDetails.startDate?.toDate?.() || new Date();
  const endDate = itemDetails.endDate?.toDate?.() || new Date();

  const rentalDays = itemDetails.rentalDays || 
    Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  const pickupTime = itemDetails.pickupTime 
    ? `${Math.floor(itemDetails.pickupTime / 60)}:${String(itemDetails.pickupTime % 60).padStart(2, '0')}`
    : "9:00 AM";

  return {
    rentalId: `RENT-${Date.now()}`,
    ownerName: isOwner 
      ? `${currentUserName.firstname} ${currentUserName.lastname}` 
      : `${recipientName.firstname} ${recipientName.lastname}`,
    renterName: !isOwner 
      ? `${currentUserName.firstname} ${currentUserName.lastname}` 
      : `${recipientName.firstname} ${recipientName.lastname}`,
    itemName: itemDetails.name || "Item",
    itemDescription: itemDetails.description || "N/A",
    rentalPrice: totalPrice,
    downpaymentAmount,
    downpaymentPercentage,
    remainingAmount,
    startDate,
    endDate,
    rentalDays,
    pickupTime,
    pickupLocation: itemDetails.itemLocation || "TBD",
    termsAndConditions: "",
    cancellationPolicy: "",
    damagePolicy: "",
  };
};