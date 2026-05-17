import { lookupAccountAction } from "@/app/actions";

export async function queryAccountByPhoneAndCode(phone: string, _lookupCode?: string) {
  return lookupAccountAction({
    phone
  });
}
