-- AlterTable
ALTER TABLE "InvestmentType" ADD COLUMN     "yahooInvestmentTypeId" TEXT;

-- CreateTable
CREATE TABLE "YahooInvestmentType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "YahooInvestmentType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YahooInvestmentType_name_key" ON "YahooInvestmentType"("name");

-- AddForeignKey
ALTER TABLE "InvestmentType" ADD CONSTRAINT "InvestmentType_yahooInvestmentTypeId_fkey" FOREIGN KEY ("yahooInvestmentTypeId") REFERENCES "YahooInvestmentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
