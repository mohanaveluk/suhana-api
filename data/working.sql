select * from suhana.temp_votes;
select * from suhana.suhanas;

select * from suhana.party;

select * from suhana.user;
SELECT * FROM suhana.country;

SELECT * FROM suhana.party_master;
select count(*) from suhana.party_master;

SELECT count(*), country_id, country.name FROM suhana.party_master 
join country on country.id = party_master.country_id
group by country_id;
-- truncate table suhana.party_master 
